"""
Vercel entry point for Noted backend
Simplified version that works on Vercel until we fix the main.py import issues
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from datetime import datetime
from typing import Optional

# Temporary in-memory storage for tokens (will move to proper DB later)
TEMP_TOKEN_STORAGE = {}

app = FastAPI(title="Noted Backend", version="1.0.0")

# CORS middleware
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

@app.get("/")
def read_root():
    return {"message": "Noted Backend API", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/oauth/check-completion")
def check_oauth_completion():
    """Check if there are any completed OAuth users"""
    users = list(TEMP_TOKEN_STORAGE.keys())
    has_users = len(users) > 0
    latest_user_id = users[-1] if users else None

    return {
        "has_users": has_users,
        "latest_user_id": latest_user_id,
        "total_users": len(users),
        "status": "success"
    }

@app.get("/user/{user_id}/status")
def get_user_status(user_id: str):
    """Get user connection status"""
    if user_id in TEMP_TOKEN_STORAGE:
        user_data = TEMP_TOKEN_STORAGE[user_id]
        return {
            "connected": True,
            "user_id": user_id,
            "status": user_data.get("status", "authorized"),
            "stored_at": user_data.get("stored_at")
        }
    else:
        return {
            "connected": False,
            "user_id": user_id,
            "error": "User not found"
        }

@app.get("/auth/notion/login")
def notion_login():
    """Redirect to Notion OAuth"""
    import os
    from urllib.parse import urlencode
    
    # Get client ID from environment variables
    client_id = os.getenv("NOTION_CLIENT_ID")
    redirect_uri = "https://noted-six.vercel.app/auth/notion/callback"
    
    if not client_id:
        raise HTTPException(
            status_code=500, 
            detail="Notion Client ID not configured. Please set NOTION_CLIENT_ID environment variable."
        )
    
    # Build proper Notion OAuth URL
    params = {
        "client_id": client_id,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": redirect_uri
    }
    
    notion_oauth_url = f"https://api.notion.com/v1/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url=notion_oauth_url)

@app.get("/auth/notion/callback")
def notion_callback(code: str, state: Optional[str] = None):
    """Handle Notion OAuth callback"""
    # Simple implementation - store the code
    user_id = f"user_{code[:8]}"

    TEMP_TOKEN_STORAGE[user_id] = {
        "auth_code": code,
        "stored_at": datetime.now().isoformat(),
        "status": "authorized"
    }

    # Return success page
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Noted - Connection Successful</title>
        <style>
            body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }}
            .container {{ max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .success {{ color: #28a745; font-size: 24px; margin-bottom: 20px; }}
            .info {{ color: #666; font-size: 16px; margin-bottom: 15px; }}
            .button {{ background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }}
            .code-info {{ background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; word-break: break-all; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success">✅ OAuth Authorization Received!</div>
            <div class="info">Your Noted extension received the authorization from Notion.</div>
            <div class="code-info">User ID: {user_id}</div>
            <div class="code-info">Storage: ✅ Success</div>
            <div class="info">You can now close this window and use the Noted extension.</div>
            <a href="#" onclick="window.close()" class="button">Close Window</a>
        </div>
    </body>
    </html>
    """

    return HTMLResponse(content=html_content)

# Export for Vercel
app = app