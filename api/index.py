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

try:
    from main import app
    print("Successfully imported main app")
except ImportError as e:
    print(f"Import error: {e}")
    import traceback
    print(f"Full traceback: {traceback.format_exc()}")
    
    # Create a minimal FastAPI app for debugging
    from fastapi import FastAPI
    app = FastAPI()
    
    @app.get("/")
    def read_root():
        return {"error": "Backend import failed", "details": str(e), "traceback": traceback.format_exc()}
    
    @app.get("/health")
    def health_check():
        return {"status": "debug_mode", "error": str(e)}

# Export the FastAPI app for Vercel
app = app
