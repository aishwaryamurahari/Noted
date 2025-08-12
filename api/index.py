"""
Vercel entry point for Noted backend
"""
import sys
import os

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Set environment variables for Vercel
os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/tokens.db')

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse
from typing import Optional
import requests
import json
from datetime import datetime

from models import (
    NotionSaveRequest, AuthResponse, SummarizeRequest, SummarizeResponse,
    SummarizeAndCategorizeRequest, SummarizeAndCategorizeResponse
)
from notion_oauth import NotionOAuth
from notion_api import NotionAPI
from storage import TokenStorage
from openai_summarizer import OpenAISummarizer
from config import settings

app = FastAPI(title="Noted Backend", version="1.0.0")

# Add CORS middleware for Chrome extension and development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:8000",
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
token_storage = TokenStorage()
notion_oauth = NotionOAuth()
notion_api = NotionAPI()
openai_summarizer = OpenAISummarizer()

@app.get("/")
def read_root():
    return {"message": "Noted Backend API", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/oauth/check-completion")
async def check_oauth_completion():
    """Check if there are any completed OAuth users - secure version"""
    try:
        users = token_storage.list_users()
        has_users = len(users) > 0
        latest_user_id = users[-1] if users else None
        
        return {
            "has_users": has_users,
            "latest_user_id": latest_user_id,
            "total_users": len(users)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking OAuth completion: {str(e)}")

@app.get("/auth/notion/login")
async def notion_login():
    """Redirect to Notion OAuth login"""
    try:
        auth_url = notion_oauth.get_authorization_url()
        return RedirectResponse(url=auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating auth URL: {str(e)}")

@app.get("/auth/notion/callback")
async def notion_callback(code: str, state: Optional[str] = None):
    """Handle Notion OAuth callback"""
    try:
        # Exchange code for access token
        token_response = notion_oauth.exchange_code_for_token(code)
        
        if not token_response or 'access_token' not in token_response:
            raise HTTPException(status_code=400, detail="Failed to get access token")
        
        access_token = token_response['access_token']
        
        # Get user info from Notion
        user_info = notion_api.get_user_info(access_token)
        user_id = user_info.get('id') if user_info else None
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        # Store the token
        success = token_storage.store_token(user_id, access_token, token_response)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to store token")
        
        # Return success page
        return HTMLResponse(f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Noted - Connection Successful</title>
            <style>
                body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; }}
                .success {{ color: green; font-size: 24px; margin-bottom: 20px; }}
                .info {{ color: #666; font-size: 16px; }}
            </style>
        </head>
        <body>
            <div class="success">✅ Successfully connected to Notion!</div>
            <div class="info">You can now close this window and use the Noted extension.</div>
            <div class="info">User ID: {user_id}</div>
        </body>
        </html>
        """)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback error: {str(e)}")

# Export the FastAPI app for Vercel
app = app