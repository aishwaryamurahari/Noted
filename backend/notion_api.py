import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime

class NotionAPI:
    """Handles Notion API operations for creating pages"""

    def __init__(self):
        self.base_url = "https://api.notion.com/v1"
        self.version = "2022-06-28"

    async def create_page(
        self,
        access_token: str,
        workspace_id: str,
        title: str,
        content: str,
        url: str
    ) -> str:
        """Create a new page in Notion workspace under SummarizeIt Dashboard"""

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": self.version,
            "Content-Type": "application/json"
        }

        # Get or create the SummarizeIt Dashboard parent page
        parent_page = await self._get_or_create_parent_page(access_token, headers)

        # Create the page content structure as a child page under SummarizeIt Dashboard
        page_data = {
            "parent": {
                "type": "page_id",
                "page_id": parent_page["id"]
            },
            "properties": {
                "title": {
                    "title": [
                        {
                            "type": "text",
                            "text": {
                                "content": f"📝 {title}"
                            }
                        }
                    ]
                }
            },
            "children": [
                {
                    "object": "block",
                    "type": "callout",
                    "callout": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": f"{datetime.now().strftime('%B %d, %Y at %H:%M')}"
                                }
                            }
                        ],
                        "icon": {
                            "emoji": "📅"
                        },
                        "color": "blue_background"
                    }
                },
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": "📋 Summary"
                                }
                            }
                        ]
                    }
                }
            ]
        }

        # Add content as flowing paragraphs instead of bullet points
        # Split content into paragraphs for better readability
        paragraphs = self._split_into_paragraphs(content)

        for paragraph in paragraphs:
            if paragraph.strip():  # Only add non-empty paragraphs
                page_data["children"].append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": paragraph.strip()
                                }
                            }
                        ]
                    }
                })

        # Add divider
        page_data["children"].append({
            "object": "block",
            "type": "divider",
            "divider": {}
        })

        # Add source link section
        page_data["children"].extend([
            {
                "object": "block",
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {
                                "content": "🔗 Source"
                            }
                        }
                    ]
                }
            },
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {
                                "content": "📖 ",
                                "link": None
                            }
                        },
                        {
                            "type": "text",
                            "text": {
                                "content": url,
                                "link": {
                                    "url": url
                                }
                            }
                        }
                    ]
                }
            }
        ])

        try:
            response = requests.post(
                f"{self.base_url}/pages",
                headers=headers,
                json=page_data
            )

            # Add detailed error logging
            if response.status_code != 200:
                error_detail = response.text
                raise Exception(f"Notion API returned {response.status_code}: {error_detail}")

            response.raise_for_status()

            page_info = response.json()
            page_url = page_info.get("url", "")
            page_id = page_info.get("id", "")

            return page_url

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to create Notion page: {str(e)}")

    def _split_into_points(self, content: str) -> list:
        """Split content into bullet points"""
        # Split by common bullet point indicators
        lines = content.split('\n')
        points = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Remove common bullet point markers
            if line.startswith('• ') or line.startswith('- ') or line.startswith('* '):
                line = line[2:]
            elif line.startswith('1. ') or line.startswith('2. ') or line.startswith('3. ') or line.startswith('4. ') or line.startswith('5. '):
                # Remove numbered list markers
                line = line[3:]

            if line:
                points.append(line)

        # If no clear points found, split by sentences
        if not points:
            import re
            sentences = re.split(r'[.!?]+', content)
            points = [s.strip() for s in sentences if s.strip()]

        return points

    def _split_into_paragraphs(self, content: str) -> list:
        """Split content into paragraphs for better readability"""
        # Split content by double line breaks (typical paragraph separators)
        paragraphs = content.split('\n\n')

        # If no double line breaks, split by single line breaks but combine short lines
        if len(paragraphs) == 1:
            lines = content.split('\n')
            paragraphs = []
            current_paragraph = ""

            for line in lines:
                line = line.strip()
                if not line:
                    if current_paragraph:
                        paragraphs.append(current_paragraph)
                        current_paragraph = ""
                    continue

                # Remove bullet point markers if present
                if line.startswith('• ') or line.startswith('- ') or line.startswith('* '):
                    line = line[2:].strip()
                elif line.startswith(('1. ', '2. ', '3. ', '4. ', '5. ', '6. ', '7. ', '8. ', '9. ')):
                    line = line[3:].strip()

                # Add to current paragraph
                if current_paragraph:
                    current_paragraph += " " + line
                else:
                    current_paragraph = line

                # If line ends with sentence-ending punctuation, consider it a paragraph break
                if line.endswith('.') or line.endswith('!') or line.endswith('?'):
                    paragraphs.append(current_paragraph)
                    current_paragraph = ""

            # Add any remaining content
            if current_paragraph:
                paragraphs.append(current_paragraph)

        # Clean up paragraphs and remove empty ones
        cleaned_paragraphs = []
        for paragraph in paragraphs:
            cleaned = paragraph.strip()
            if cleaned and len(cleaned) > 10:  # Only include substantial paragraphs
                cleaned_paragraphs.append(cleaned)

        return cleaned_paragraphs if cleaned_paragraphs else [content.strip()]

    async def get_workspace_info(self, access_token: str) -> Dict[str, Any]:
        """Get workspace information"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": self.version
        }

        try:
            response = requests.get(
                f"{self.base_url}/users/me",
                headers=headers
            )
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to get workspace info: {str(e)}")

    async def search_pages(self, access_token: str, query: str = "") -> Dict[str, Any]:
        """Search for pages in the workspace"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": self.version,
            "Content-Type": "application/json"
        }

        search_data = {
            "query": query,
            "filter": {
                "property": "object",
                "value": "page"
            }
        }

        try:
            response = requests.post(
                f"{self.base_url}/search",
                headers=headers,
                json=search_data
            )
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to search pages: {str(e)}")

    async def update_page(
        self,
        access_token: str,
        page_id: str,
        properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an existing page"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": self.version,
            "Content-Type": "application/json"
        }

        update_data = {
            "properties": properties
        }

        try:
            response = requests.patch(
                f"{self.base_url}/pages/{page_id}",
                headers=headers,
                json=update_data
            )
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to update page: {str(e)}")

    async def _get_or_create_parent_page(self, access_token: str, headers: Dict[str, str]) -> Dict[str, Any]:
        """Get or create a parent page for SummarizeIt summaries"""

        # First, search for existing SummarizeIt parent page
        search_data = {
            "query": "SummarizeIt Dashboard",
            "filter": {
                "property": "object",
                "value": "page"
            },
            "page_size": 10
        }

        response = requests.post(
            f"{self.base_url}/search",
            headers=headers,
            json=search_data
        )
        response.raise_for_status()
        search_results = response.json()

        # Check if we found the parent page
        for page in search_results.get("results", []):
            page_title = ""
            if page.get("properties", {}).get("title"):
                # For pages, title is in properties
                title_property = page["properties"]["title"]
                if title_property.get("title") and len(title_property["title"]) > 0:
                    page_title = title_property["title"][0].get("text", {}).get("content", "")

            if page_title == "SummarizeIt Dashboard":
                return page

        # If no parent page found, create one
        page_data = {
            "parent": {
                "type": "workspace",
                "workspace": True
            },
            "properties": {
                "title": {
                    "title": [
                        {
                            "type": "text",
                            "text": {
                                "content": "SummarizeIt Dashboard"
                            }
                        }
                    ]
                }
            },
            "children": [
                # {
                #     "object": "block",
                #     "type": "heading_1",
                #     "heading_1": {
                #         "rich_text": [
                #             {
                #                 "type": "text",
                #                 "text": {
                #                     "content": "📚 SummarizeIt Dashboard"
                #                 }
                #             }
                #         ]
                #     }
                # },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": "Welcome to your SummarizeIt dashboard! This page contains your summarized articles and web content."
                                }
                            }
                        ]
                    }
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": "📄 Each article summary is saved as a separate page under this dashboard for easy reading and organization."
                                }
                            }
                        ]
                    }
                }
            ]
        }

        response = requests.post(
            f"{self.base_url}/pages",
            headers=headers,
            json=page_data
        )
        response.raise_for_status()

        new_page = response.json()

        return new_page

