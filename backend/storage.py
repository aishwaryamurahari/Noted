import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from config import settings
import os

class TokenStorage:
    """SQLite storage for user access tokens"""

    def __init__(self, db_path: str = "tokens.db"):
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """Initialize the database and create tables if they don't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create tokens table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tokens (
                user_id TEXT PRIMARY KEY,
                access_token TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    def store_token(self, user_id: str, access_token: str, workspace_id: str) -> bool:
        """Store or update user's access token"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Use INSERT OR REPLACE to handle both new and existing users
            cursor.execute('''
                INSERT OR REPLACE INTO tokens
                (user_id, access_token, workspace_id, updated_at)
                VALUES (?, ?, ?, ?)
            ''', (user_id, access_token, workspace_id, datetime.now()))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error storing token: {e}")
            return False

    def get_token(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user's access token"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                SELECT access_token, workspace_id, created_at, updated_at
                FROM tokens
                WHERE user_id = ?
            ''', (user_id,))

            result = cursor.fetchone()
            conn.close()

            if result:
                return {
                    "access_token": result[0],
                    "workspace_id": result[1],
                    "created_at": result[2],
                    "updated_at": result[3]
                }
            return None

        except Exception as e:
            print(f"Error retrieving token: {e}")
            return None

    def delete_token(self, user_id: str) -> bool:
        """Delete user's access token"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('DELETE FROM tokens WHERE user_id = ?', (user_id,))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print(f"Error deleting token: {e}")
            return False

    def list_users(self) -> list:
        """List all users with stored tokens"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('SELECT user_id, workspace_id, created_at FROM tokens')
            results = cursor.fetchall()

            conn.close()

            return [
                {
                    "user_id": row[0],
                    "workspace_id": row[1],
                    "created_at": row[2]
                }
                for row in results
            ]

        except Exception as e:
            print(f"Error listing users: {e}")
            return []

    def cleanup_expired_tokens(self, days: int = 30) -> int:
        """Remove tokens older than specified days"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                DELETE FROM tokens
                WHERE updated_at < datetime('now', '-{} days')
            '''.format(days))

            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()

            return deleted_count

        except Exception as e:
            print(f"Error cleaning up expired tokens: {e}")
            return 0


class InMemoryTokenStorage:
    """In-memory storage for user access tokens (for serverless environments)"""

    def __init__(self):
        self._storage: Dict[str, Dict[str, Any]] = {}

    def store_token(self, user_id: str, access_token: str, workspace_id: str) -> bool:
        """Store or update user's access token in memory"""
        try:
            self._storage[user_id] = {
                "access_token": access_token,
                "workspace_id": workspace_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            return True
        except Exception as e:
            print(f"Error storing token in memory: {e}")
            return False

    def get_token(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user's access token from memory"""
        return self._storage.get(user_id)

    def delete_token(self, user_id: str) -> bool:
        """Delete user's access token from memory"""
        try:
            if user_id in self._storage:
                del self._storage[user_id]
            return True
        except Exception as e:
            print(f"Error deleting token from memory: {e}")
            return False

    def list_users(self) -> List[Dict[str, Any]]:
        """List all users with stored tokens"""
        return [
            {
                "user_id": user_id,
                "workspace_id": data["workspace_id"],
                "created_at": data["created_at"]
            }
            for user_id, data in self._storage.items()
        ]

    def cleanup_expired_tokens(self, days: int = 30) -> int:
        """Remove tokens older than specified days (no-op for in-memory storage)"""
        # In-memory storage doesn't persist across restarts, so cleanup is not needed
        return 0