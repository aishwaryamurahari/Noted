"""
Minimal Vercel entry point for debugging
"""

from fastapi import FastAPI

# Create a minimal app for testing
app = FastAPI(title="Noted Backend", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "Hello from Noted Backend!", "status": "working"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Minimal API is working"}

@app.get("/test")
def test_endpoint():
    return {"test": "success", "message": "Basic endpoint working"}

# Try importing backend modules one by one to identify the issue
@app.get("/debug/imports")
def debug_imports():
    import sys
    import os
    
    # Add backend path
    backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
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
    
    return {
        "backend_path": backend_path,
        "sys_path": sys.path[:3],  # First 3 paths
        "imports": results
    }

# Export for Vercel
app = app