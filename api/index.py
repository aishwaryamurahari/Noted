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

# Temporary in-memory storage for tokens (for testing)
TEMP_TOKEN_STORAGE = {}

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
    # Use in-memory storage for now (for testing)
    users = list(TEMP_TOKEN_STORAGE.keys())
    has_users = len(users) > 0
    latest_user_id = users[-1] if users else None
    
    return {
        "has_users": has_users,
        "latest_user_id": latest_user_id,
        "total_users": len(users),
        "status": "success",
        "storage_type": "in_memory"
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
def notion_callback(code: str, state: str = None):
    """Handle Notion OAuth callback"""
    from fastapi.responses import HTMLResponse

    try:
        # Try to process the OAuth and store tokens
        from notion_oauth import NotionOAuth
        from notion_api import NotionAPI
        from storage import TokenStorage

        notion_oauth = NotionOAuth()
        notion_api = NotionAPI()
        token_storage = TokenStorage()

        # Exchange code for access token
        token_response = notion_oauth.exchange_code_for_token(code)

        if token_response and 'access_token' in token_response:
            access_token = token_response['access_token']

            # Get user info from Notion
            user_info = notion_api.get_user_info(access_token)
            user_id = user_info.get('id') if user_info else f"temp_user_{code[:8]}"

            # Store the token in memory for now (will work for testing)
            try:
                # Store in memory
                TEMP_TOKEN_STORAGE[user_id] = {
                    "access_token": access_token,
                    "token_response": token_response,
                    "stored_at": datetime.now().isoformat()
                }
                storage_success = True
                storage_message = f"Token stored successfully for user: {user_id}"
            except Exception as storage_error:
                storage_success = False
                storage_message = f"Token storage failed: {str(storage_error)}"

        else:
            storage_success = False
            storage_message = "Failed to exchange code for token"
            user_id = "unknown"

    except Exception as e:
        # If anything fails, still show a success page but note the issue
        storage_success = False
        storage_message = f"OAuth processing error: {str(e)}"
        user_id = "unknown"

    # Success page with debug info
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
            <div class="code-info">Auth Code: {code[:20] if len(code) > 20 else code}...</div>
            <div class="code-info">User ID: {user_id}</div>
            <div class="code-info">Storage: {"✅ Success" if storage_success else "❌ Failed"}</div>
            <div class="info"><small>{storage_message}</small></div>
            <div class="info">You can now close this window and use the Noted extension.</div>
            <a href="#" onclick="window.close()" class="button">Close Window</a>
        </div>
    </body>
    </html>
    """

    return HTMLResponse(content=html_content)

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