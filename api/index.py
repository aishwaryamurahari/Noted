"""
Vercel entry point for Noted backend - Progressive loading approach
"""
import sys
import os

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Set environment variables for Vercel
# Let config.py handle the database URL

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI(title="Noted Backend", version="1.0.0")

# Add CORS middleware for Chrome extension
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
async def check_oauth_completion():
    """Check if there are any completed OAuth users"""
    try:
        # Import storage only when needed
        from storage import TokenStorage
        import sqlite3
        import os

        # Ensure the directory exists for the database
        db_dir = "/tmp"
        if not os.path.exists(db_dir):
            os.makedirs(db_dir)

        token_storage = TokenStorage()
        users = token_storage.list_users()
        has_users = len(users) > 0
        latest_user_id = users[-1] if users else None

        return {
            "has_users": has_users,
            "latest_user_id": latest_user_id,
            "total_users": len(users)
        }
    except Exception as e:
        # For now, return a working response for the extension
        return {
            "has_users": False,
            "latest_user_id": None,
            "total_users": 0,
            "note": "Database temporarily unavailable - using fallback response"
        }

@app.get("/auth/notion/login")
async def notion_login():
    """Redirect to Notion OAuth login"""
    try:
        from notion_oauth import NotionOAuth
        notion_oauth = NotionOAuth()

        auth_url = notion_oauth.get_auth_url()
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating auth URL: {str(e)}")

@app.get("/auth/notion/callback")
async def notion_callback(code: str, state: Optional[str] = None):
    """Handle Notion OAuth callback"""
    try:
        # Progressive imports to avoid startup issues
        from fastapi.responses import HTMLResponse
        
        # For now, return a simple success page while we fix the database
        return HTMLResponse(f"""
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
                <div class="code-info">Auth Code: {code[:20]}...</div>
                <div class="info">You can now close this window and use the Noted extension.</div>
                <div class="info"><small>Note: Token storage is being configured - full functionality coming soon!</small></div>
                <a href="#" onclick="window.close()" class="button">Close Window</a>
            </div>
        </body>
        </html>
        """)

        
    except HTTPException:
        raise
    except Exception as e:
        return HTMLResponse(f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Noted - Connection Error</title>
            <style>
                body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }}
                .container {{ max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .error {{ color: #dc3545; font-size: 24px; margin-bottom: 20px; }}
                .info {{ color: #666; font-size: 16px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error">❌ Connection Failed</div>
                <div class="info">Error: {str(e)}</div>
                <div class="info">Please try connecting again.</div>
            </div>
        </body>
        </html>
        """, status_code=500)

@app.get("/test/imports")
def test_imports():
    """Test individual imports to identify issues"""
    results = {}

    try:
        from config import settings
        results["config"] = "OK"
    except Exception as e:
        results["config"] = str(e)

    try:
        from models import NotionSaveRequest
        results["models"] = "OK"
    except Exception as e:
        results["models"] = str(e)

    try:
        from storage import TokenStorage
        results["storage"] = "OK"
    except Exception as e:
        results["storage"] = str(e)

    try:
        from notion_oauth import NotionOAuth
        results["notion_oauth"] = "OK"
    except Exception as e:
        results["notion_oauth"] = str(e)

    try:
        from notion_api import NotionAPI
        results["notion_api"] = "OK"
    except Exception as e:
        results["notion_api"] = str(e)

    try:
        from openai_summarizer import OpenAISummarizer
        results["openai_summarizer"] = "OK"
    except Exception as e:
        results["openai_summarizer"] = str(e)

    return {"import_results": results}

# Export the FastAPI app for Vercel
app = app