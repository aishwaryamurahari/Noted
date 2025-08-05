from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime

class NotionSaveRequest(BaseModel):
    """Request model for saving to Notion"""
    summary: str
    url: str
    title: str
    user_id: str
    category: Optional[str] = "General News"  # Category for smart organization

class NotionSaveResponse(BaseModel):
    """Response model for Notion save"""
    page_url: str

class AuthResponse(BaseModel):
    """Response model for authentication status"""
    connected: bool
    workspace_id: Optional[str] = None

class TokenData(BaseModel):
    """Model for stored token data"""
    user_id: str
    access_token: str
    workspace_id: str
    created_at: datetime

class UserInfo(BaseModel):
    """Model for Notion user information"""
    id: str
    name: Optional[str] = None
    email: Optional[str] = None

class SummarizeRequest(BaseModel):
    """Request model for content summarization"""
    content: str
    title: Optional[str] = None
    openai_api_key: str

class SummarizeResponse(BaseModel):
    """Response model for summarization"""
    summary: str
    category: Optional[str] = None  # Auto-detected category

class SummarizeAndCategorizeRequest(BaseModel):
    """Request model for content summarization with categorization"""
    content: str
    title: str
    openai_api_key: str

class SummarizeAndCategorizeResponse(BaseModel):
    """Response model for summarization with categorization"""
    summary: str
    category: str