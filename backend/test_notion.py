#!/usr/bin/env python3
"""
Test script for Notion API debugging
"""

import asyncio
import sys
import os

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from notion_api import NotionAPI
from storage import TokenStorage

async def test_notion_api():
    """Test the Notion API with a specific user"""

    # Initialize components
    token_storage = TokenStorage()
    notion_api = NotionAPI()

    # Get all users
    users = token_storage.list_users()
    print(f"Found {len(users)} users in database:")
    for user in users:
        print(f"  - User ID: {user['user_id']}, Workspace: {user['workspace_id']}")

    if not users:
        print("No users found. Please authenticate with Notion first.")
        return

    # Test with the first user
    user_id = users[0]['user_id']
    print(f"\nTesting with user: {user_id}")

    # Get token data
    token_data = token_storage.get_token(user_id)
    if not token_data:
        print("No token data found for user")
        return

    print(f"Token data: {token_data}")

    # Test getting workspace info
    try:
        print("\nTesting get_workspace_info...")
        workspace_info = await notion_api.get_workspace_info(token_data["access_token"])
        print(f"Workspace info: {workspace_info}")
    except Exception as e:
        print(f"Error getting workspace info: {e}")

    # Test creating a page
    try:
        print("\nTesting page creation...")
        page_url = await notion_api.create_page(
            access_token=token_data["access_token"],
            workspace_id=token_data["workspace_id"],
            title="Test Summary",
            content="This is a test summary created by the debug script.",
            url="https://example.com/test"
        )
        print(f"Successfully created page: {page_url}")
    except Exception as e:
        print(f"Error creating page: {e}")

if __name__ == "__main__":
    asyncio.run(test_notion_api())