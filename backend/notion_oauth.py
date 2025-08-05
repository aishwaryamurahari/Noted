import requests
import json
from typing import Dict, Any, Optional
from config import settings
import urllib.parse

class NotionOAuth:
    """Handles Notion OAuth 2.0 flow"""

    def __init__(self):
        self.client_id = settings.NOTION_CLIENT_ID
        self.client_secret = settings.NOTION_CLIENT_SECRET
        self.redirect_uri = settings.NOTION_REDIRECT_URI
        self.auth_url = "https://api.notion.com/v1/oauth/authorize"
        self.token_url = "https://api.notion.com/v1/oauth/token"
        self.user_url = "https://api.notion.com/v1/users/me"

    def get_auth_url(self, state: Optional[str] = None) -> str:
        """Generate Notion OAuth authorization URL"""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "owner": "user"
        }

        if state:
            params["state"] = state

        query_string = urllib.parse.urlencode(params)
        return f"{self.auth_url}?{query_string}"

    def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        headers = {
            "Authorization": f"Basic {self._get_basic_auth()}",
            "Content-Type": "application/json"
        }

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri
        }

        try:
            response = requests.post(
                self.token_url,
                headers=headers,
                json=data
            )
            response.raise_for_status()

            token_data = response.json()

            # Extract workspace_id from the response
            workspace_id = token_data.get("workspace_id", "unknown")

            return {
                "access_token": token_data["access_token"],
                "workspace_id": workspace_id,
                "token_type": token_data.get("token_type", "bearer"),
                "bot_id": token_data.get("bot_id"),
                "workspace_name": token_data.get("workspace_name"),
                "workspace_icon": token_data.get("workspace_icon")
            }

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to exchange code for token: {str(e)}")

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Notion API"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": "2022-06-28"
        }

        try:
            response = requests.get(self.user_url, headers=headers)
            response.raise_for_status()

            user_data = response.json()

            return {
                "id": user_data.get("id"),
                "name": user_data.get("name"),
                "email": user_data.get("person", {}).get("email"),
                "avatar_url": user_data.get("avatar_url"),
                "type": user_data.get("type")
            }

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to get user info: {str(e)}")

    def _get_basic_auth(self) -> str:
        """Generate Basic Auth header for token exchange"""
        import base64
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return encoded

    def validate_token(self, access_token: str) -> bool:
        """Validate if access token is still valid"""
        try:
            self.get_user_info(access_token)
            return True
        except Exception:
            return False

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        headers = {
            "Authorization": f"Basic {self._get_basic_auth()}",
            "Content-Type": "application/json"
        }

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }

        try:
            response = requests.post(
                self.token_url,
                headers=headers,
                json=data
            )
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to refresh token: {str(e)}")