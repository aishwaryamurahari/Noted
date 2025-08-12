"""
Vercel entry point for Noted backend
"""
import sys
import os

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Set environment for Vercel
os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/tokens.db')

try:
    # Import the main FastAPI app from backend
    from main import app
    print("✅ Successfully imported main app from backend/main.py")
    
    # Export for Vercel
    app = app
    
except ImportError as e:
    print(f"❌ Failed to import main app: {e}")
    
    # Fallback minimal app
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI(title="Noted Backend - Fallback", version="1.0.0")
    
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
    def fallback_root():
        return {
            "message": "Noted Backend - Fallback Mode",
            "error": f"Main app import failed: {str(e)}",
            "status": "degraded"
        }
    
    @app.get("/health")
    def fallback_health():
        return {
            "status": "fallback_mode",
            "error": str(e),
            "message": "Running in fallback mode due to import failure"
        }