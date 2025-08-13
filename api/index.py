import sys
import os

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Set environment variable to indicate we're running on Vercel
os.environ['VERCEL'] = '1'

# Import the main FastAPI app (now serverless-compatible)
from main import app

# Export the app for Vercel
app = app