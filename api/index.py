"""
Vercel entry point for Noted backend
"""
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

try:
    from main import app
except ImportError as e:
    print(f"Import error: {e}")
    # Create a minimal FastAPI app for debugging
    from fastapi import FastAPI
    app = FastAPI()
    
    @app.get("/")
    def read_root():
        return {"error": "Backend import failed", "details": str(e)}

# Export the FastAPI app for Vercel
def handler(request):
    """Vercel serverless function handler"""
    return app

# For Vercel Python runtime
app = app
