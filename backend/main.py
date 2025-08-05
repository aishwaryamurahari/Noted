from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse
import uvicorn
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

app = FastAPI(title="SummarizeIt Backend", version="1.0.0")

# Add CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
token_storage = TokenStorage()
notion_oauth = NotionOAuth()
notion_api = NotionAPI()
openai_summarizer = OpenAISummarizer()

@app.get("/debug/user/{user_id}")
async def debug_user(user_id: str):
    """Debug endpoint to check specific user's token"""
    token_data = token_storage.get_token(user_id)

    # Test Notion connection if token exists
    notion_status = "not_connected"
    workspace_info = None

    if token_data:
        try:
            workspace_info = await notion_api.get_workspace_info(token_data["access_token"])
            notion_status = "connected"
        except Exception as e:
            notion_status = f"error: {str(e)}"

    return {
        "user_id": user_id,
        "has_token": token_data is not None,
        "token_data": token_data,
        "notion_status": notion_status,
        "workspace_info": workspace_info
    }

@app.get("/debug/users")
async def debug_users():
    """Debug endpoint to list all users in database"""
    users = token_storage.list_users()
    return {
        "total_users": len(users),
        "users": users
    }

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to check configuration"""
    return {
        "notion_client_id": settings.NOTION_CLIENT_ID,
        "notion_client_secret": "***" if settings.NOTION_CLIENT_SECRET else "NOT_SET",
        "notion_redirect_uri": settings.NOTION_REDIRECT_URI,
        "host": settings.HOST,
        "port": settings.PORT,
        "secret_key": "***" if settings.SECRET_KEY else "NOT_SET"
    }

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SummarizeIt Backend is running"}

@app.get("/auth/notion/login")
async def notion_login():
    """Redirect user to Notion OAuth login page"""
    auth_url = notion_oauth.get_auth_url()
    return RedirectResponse(url=auth_url)

@app.get("/auth/notion/callback")
async def notion_callback(code: str, state: Optional[str] = None):
    """Handle Notion OAuth callback and store access token"""
    try:
        # Exchange code for access token
        token_data = notion_oauth.exchange_code_for_token(code)

        # Get user info from Notion
        user_info = notion_oauth.get_user_info(token_data["access_token"])

        # Store token in database
        user_id = user_info.get("id", "unknown")

        token_storage.store_token(
            user_id=user_id,
            access_token=token_data["access_token"],
            workspace_id=token_data.get("workspace_id", "unknown")
        )

        # Verify the token was stored correctly
        stored_token = token_storage.get_token(user_id)
        if not stored_token:
            raise Exception("Failed to store token in database")

        # Return success HTML page with user ID
        success_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Notion Connected Successfully</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }}
                .success {{
                    color: #86efac;
                    font-size: 24px;
                    margin-bottom: 20px;
                }}
                .message {{
                    margin: 20px 0;
                    opacity: 0.9;
                }}
                .close-btn {{
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 20px;
                }}
                .close-btn:hover {{
                    background: rgba(255, 255, 255, 0.3);
                }}
                .user-id {{
                    font-size: 12px;
                    opacity: 0.7;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="success">✅ Successfully Connected to Notion!</div>
            <div class="message">You can now close this window and return to the SummarizeIt extension.</div>
            <div class="message">Make sure to enter your OpenAI API key in the extension settings.</div>
            <div class="user-id">User ID: {user_id}</div>
            <div id="user-id" style="display: none;">{user_id}</div>
            <button class="close-btn" onclick="window.close()">Close Window</button>
            <script>
                // Auto-close after 3 seconds
                setTimeout(() => {{
                    window.close();
                }}, 3000);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=success_html)

    except Exception as e:
        # Return error HTML page
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Connection Failed</title>
            <style>
                body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; }}
                .error {{ color: red; font-size: 24px; }}
                .message {{ margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="error">❌ Connection Failed</div>
            <div class="message">Error: {str(e)}</div>
            <div class="message">Please try again or check your Notion integration settings.</div>
            <script>
                // Close tab after 5 seconds
                setTimeout(() => {{
                    window.close();
                }}, 5000);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=error_html)

@app.post("/notion/save")
async def save_to_notion(request: NotionSaveRequest):
    """Save summary to user's Notion workspace with smart categorization"""
    try:
        # Get user's access token
        token_data = token_storage.get_token(request.user_id)
        if not token_data:
            raise HTTPException(status_code=401, detail="User not authenticated with Notion")

        # Create page in Notion with category organization
        page_url = await notion_api.create_categorized_page(
            access_token=token_data["access_token"],
            workspace_id=token_data["workspace_id"],
            title=f"Summary - {request.title}",
            content=request.summary,
            url=request.url,
            category=request.category or "General News"
        )

        return {"page_url": page_url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save to Notion: {str(e)}")

@app.post("/summarize")
async def summarize_content(request: SummarizeRequest):
    """Summarize content using OpenAI to create concise summaries"""
    try:
        # Set the OpenAI API key for this request
        openai_summarizer.set_api_key(request.openai_api_key)

        # Create summary using OpenAI
        summary = await openai_summarizer.summarize(
            content=request.content,
            max_length=None  # Use default max_tokens
        )

        return SummarizeResponse(summary=summary)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

@app.post("/summarize-and-categorize")
async def summarize_and_categorize_content(request: SummarizeAndCategorizeRequest):
    """Summarize content and automatically categorize it using OpenAI"""
    try:
        # Set the OpenAI API key for this request
        openai_summarizer.set_api_key(request.openai_api_key)

        # Create summary and category using OpenAI
        result = await openai_summarizer.summarize_and_categorize(
            content=request.content,
            title=request.title,
            max_length=None  # Use default max_tokens
        )

        return SummarizeAndCategorizeResponse(
            summary=result["summary"],
            category=result["category"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary and category: {str(e)}")

@app.get("/categories")
async def get_available_categories():
    """Get list of available categories for articles"""
    return {
        "categories": list(openai_summarizer.categories.keys()),
        "descriptions": openai_summarizer.categories
    }

@app.get("/user/{user_id}/status")
async def get_user_status(user_id: str):
    """Check if user is connected to Notion"""
    token_data = token_storage.get_token(user_id)
    return {
        "connected": token_data is not None,
        "workspace_id": token_data["workspace_id"] if token_data else None
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)