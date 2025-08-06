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
        """Create a new page in Notion workspace under Noted Dashboard"""

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": self.version,
            "Content-Type": "application/json"
        }

        # Get or create the Noted Dashboard parent page
        parent_page = await self._get_or_create_parent_page(access_token, headers)

        # Create the page content structure as a child page under Noted Dashboard
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
                                    "content": "📋 Note"
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

    async def create_categorized_page(
        self,
        access_token: str,
        workspace_id: str,
        title: str,
        content: str,
        url: str,
        category: str
    ) -> str:
        """Create a new page in Notion workspace organized by category"""

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Notion-Version": self.version,
            "Content-Type": "application/json"
        }

        # Get or create the Noted Dashboard parent page
        parent_page = await self._get_or_create_parent_page(access_token, headers)

        # Get or create the category section within the dashboard
        category_page = await self._get_or_create_category_page(access_token, headers, parent_page["id"], category)

        # Create emoji based on category
        category_emojis = {
            "Technology & AI": "🤖",
            "Sports": "⚽",
            "Business & Finance": "💼",
            "Health & Medicine": "🏥",
            "Science": "🔬",
            "Politics": "🏛️",
            "Entertainment": "🎬",
            "Education": "📚",
            "Travel & Lifestyle": "✈️",
            "General News": "📰"
        }
        emoji = category_emojis.get(category, "📰")

        # Create the page content structure as a child page under the category
        page_data = {
            "parent": {
                "type": "page_id",
                "page_id": category_page["id"]
            },
            "properties": {
                "title": {
                    "title": [
                        {
                            "type": "text",
                            "text": {
                                "content": f"{emoji} {title}"
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
                                    "content": f"Category: {category}"
                                }
                            }
                        ],
                        "icon": {
                            "emoji": emoji
                        },
                        "color": "blue_background"
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
                                    "content": f"🔗 Original Article: "
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
                },
                {
                    "object": "block",
                    "type": "divider",
                    "divider": {}
                },
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": "📝 Note"
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
                                    "content": content
                                }
                            }
                        ]
                    }
                },
                {
                    "object": "block",
                    "type": "divider",
                    "divider": {}
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": f"📅 Saved on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
                                },
                                "annotations": {
                                    "italic": True,
                                    "color": "gray"
                                }
                            }
                        ]
                    }
                }
            ]
        }

        # Create the page
        create_response = requests.post(
            f"{self.base_url}/pages",
            headers=headers,
            json=page_data
        )

        if create_response.status_code != 200:
            raise Exception(f"Failed to create categorized page: {create_response.text}")

        new_page = create_response.json()
        page_url = new_page.get("url", "")

        print(f"Created categorized page in category '{category}': {page_url}")
        return page_url

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
        """Get or create a parent page for Noted summaries"""

        # First, search for existing Noted parent page
        search_data = {
            "query": "Noted Dashboard",
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

            if page_title == "Noted Dashboard":
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
                                "content": "Noted Dashboard"
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
                                    #                     "content": "📚 Noted Dashboard"
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
                                    "content": "Never lose a highlight — it’s Noted!"
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
                                    "content": "📄 Each article note is saved as a separate page under this dashboard for easy reading and organization."
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

    async def _get_or_create_category_page(self, access_token: str, headers: Dict[str, str], parent_page_id: str, category: str) -> Dict[str, Any]:
        """Get or create a category page within the Noted Dashboard"""

        # First, get the children of the parent page to see if category page exists
        children_response = requests.get(
            f"{self.base_url}/blocks/{parent_page_id}/children",
            headers=headers
        )

        if children_response.status_code != 200:
            raise Exception(f"Failed to get parent page children: {children_response.text}")

        children_data = children_response.json()

        # Look for existing category page
        for child in children_data.get("results", []):
            if child.get("type") == "child_page":
                child_page_response = requests.get(
                    f"{self.base_url}/pages/{child['id']}",
                    headers=headers
                )

                if child_page_response.status_code == 200:
                    page_data = child_page_response.json()
                    title_property = page_data.get("properties", {}).get("title", {})
                    title_content = title_property.get("title", [])

                    if title_content and len(title_content) > 0:
                        page_title = title_content[0].get("text", {}).get("content", "")
                        if page_title == f"📂 {category}":
                            return page_data

        # Category page doesn't exist, create it
        category_emojis = {
            "Technology & AI": "🤖",
            "Sports": "⚽",
            "Business & Finance": "💼",
            "Health & Medicine": "🏥",
            "Science": "🔬",
            "Politics": "🏛️",
            "Entertainment": "🎬",
            "Education": "📚",
            "Travel & Lifestyle": "✈️",
            "General News": "📰"
        }
        emoji = category_emojis.get(category, "📰")

        category_page_data = {
            "parent": {
                "type": "page_id",
                "page_id": parent_page_id
            },
            "properties": {
                "title": {
                    "title": [
                        {
                            "type": "text",
                            "text": {
                                "content": f"{emoji} {category}"
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
                #                     "content": f"{emoji} {category}"
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
                                    "content": f"Articles related to {category.lower()} will appear below:"
                                },
                                "annotations": {
                                    "italic": True
                                }
                            }
                        ]
                    }
                },
                {
                    "object": "block",
                    "type": "divider",
                    "divider": {}
                }
            ]
        }

        create_response = requests.post(
            f"{self.base_url}/pages",
            headers=headers,
            json=category_page_data
        )

        if create_response.status_code != 200:
            raise Exception(f"Failed to create category page: {create_response.text}")

        return create_response.json()

