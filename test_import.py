"""
Test script to see what fails when importing main.py
"""
import sys
import os
import traceback

# Add backend to path
sys.path.insert(0, 'backend')

# Set environment for testing
os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/tokens.db')

try:
    print("🧪 Testing individual imports...")

    # Test config first
    print("1. Testing config import...")
    from config import settings
    print(f"   ✅ Config loaded. CLIENT_ID set: {bool(settings.NOTION_CLIENT_ID)}")

    # Test storage
    print("2. Testing storage import...")
    from storage import TokenStorage
    print("   ✅ Storage class imported")

    print("3. Testing storage instantiation...")
    storage = TokenStorage()
    print("   ✅ Storage instantiated")

    # Test OAuth
    print("4. Testing OAuth import...")
    from notion_oauth import NotionOAuth
    oauth = NotionOAuth()
    print("   ✅ OAuth instantiated")

    # Test main import
    print("5. Testing main.py import...")
    from main import app
    print("   ✅ Main app imported successfully!")

except Exception as e:
    print(f"   ❌ Import failed: {e}")
    print(f"   Full error: {traceback.format_exc()}")
