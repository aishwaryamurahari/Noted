import asyncio
from typing import Optional, Dict, Any
from openai import OpenAI

class OpenAISummarizer:
    """Handles article summarization using OpenAI GPT-3.5"""

    def __init__(self):
        self.api_key = None  # Will be set per request
        self.model = "gpt-3.5-turbo"
        self.max_tokens = 1000
        self.client = None  # Will be created when API key is set

        # Predefined categories for smart categorization
        self.categories = {
            "Technology & AI": "Articles about technology, artificial intelligence, software, programming, cybersecurity, and digital innovation",
            "Sports": "Sports news, games, athletes, fitness, and sports-related content",
            "Business & Finance": "Business news, finance, economics, markets, entrepreneurship, and corporate affairs",
            "Health & Medicine": "Health, medical research, wellness, healthcare, mental health, and medical breakthroughs",
            "Science": "Scientific research, discoveries, space, environment, climate, and academic studies",
            "Politics": "Political news, government, policy, elections, international relations, and civic affairs",
            "Entertainment": "Movies, TV shows, music, celebrities, gaming, and entertainment industry news",
            "Education": "Educational content, learning, academic institutions, and educational technology",
            "Travel & Lifestyle": "Travel, lifestyle, culture, food, fashion, and personal development",
            "General News": "General news articles that don't fit into specific categories"
        }

    async def summarize_and_categorize(self, content: str, title: str = "", max_length: Optional[int] = None) -> Dict[str, str]:
        """Summarize article content and categorize it using OpenAI GPT-3.5"""

        if not self.client:
            raise Exception("OpenAI API key not configured")

        # Truncate content if it's too long (OpenAI has token limits)
        max_content_length = 4000  # Approximate token limit for input
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        # Create categories list for the prompt
        categories_list = ", ".join(self.categories.keys())

        # Create the enhanced prompt for summarization and categorization
        prompt = f"""
        Please analyze the following article and provide two things:
        1. A concise summary focusing on the main points and key insights
        2. The most appropriate category from the list below

        Available categories: {categories_list}

        Article title: {title}
        Article content: {content}

        Please respond in the following JSON format:
        {{
            "summary": "Your concise summary here",
            "category": "The most appropriate category from the list"
        }}

        Make sure to:
        - Keep the summary clear, well-structured, and informative
        - Choose the category that best matches the article's primary topic
        - If unsure about category, default to "General News"
        """

        try:
            # Use asyncio to make the API call non-blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._make_openai_request_for_categorization,
                prompt,
                max_length
            )

            return response

        except Exception as e:
            raise Exception(f"Failed to summarize and categorize content: {str(e)}")

    async def summarize(self, content: str, max_length: Optional[int] = None) -> str:
        """Summarize article content using OpenAI GPT-3.5 (legacy method for backward compatibility)"""

        if not self.client:
            raise Exception("OpenAI API key not configured")

        # Truncate content if it's too long (OpenAI has token limits)
        max_content_length = 4000  # Approximate token limit for input
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        # Create the prompt for summarization
        prompt = f"""
        Please provide a concise summary of the following article.
        Focus on the main points and key insights.
        Keep the summary clear and well-structured.

        Article content:
        {content}

        Summary:
        """

        try:
            # Use asyncio to make the API call non-blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._make_openai_request,
                prompt,
                max_length
            )

            return response.strip()

        except Exception as e:
            raise Exception(f"Failed to summarize content: {str(e)}")

    def set_api_key(self, api_key: str):
        """Set the OpenAI API key and create client"""
        self.api_key = api_key
        self.client = OpenAI(api_key=api_key)

    def _make_openai_request_for_categorization(self, prompt: str, max_length: Optional[int] = None) -> Dict[str, str]:
        """Make OpenAI request for summarization and categorization"""

        if not self.client:
            raise Exception("OpenAI API key not provided")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates clear, concise summaries and accurately categorizes articles. Always respond with valid JSON format as requested."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=max_length or self.max_tokens,
                temperature=0.3,  # Lower temperature for more consistent results
                top_p=0.9
            )

            content = response.choices[0].message.content.strip()

            # Try to parse JSON response
            try:
                import json
                result = json.loads(content)

                # Validate response structure
                if "summary" not in result or "category" not in result:
                    raise ValueError("Invalid response structure")

                # Validate category
                if result["category"] not in self.categories:
                    result["category"] = "General News"

                return result

            except (json.JSONDecodeError, ValueError) as e:
                # Fallback: extract summary and set default category
                return {
                    "summary": content,
                    "category": "General News"
                }

        except Exception as e:
            raise Exception(f"OpenAI API request failed: {str(e)}")

    def _make_openai_request(self, prompt: str, max_length: Optional[int] = None) -> str:

        if not self.client:
            raise Exception("OpenAI API key not provided")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates clear, concise summaries of articles. Focus on the main points and key insights."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=max_length or self.max_tokens,
                temperature=0.3,  # Lower temperature for more consistent summaries
                top_p=0.9
            )

            return response.choices[0].message.content

        except Exception as e:
            raise Exception(f"OpenAI API request failed: {str(e)}")

    async def summarize_with_bullet_points(self, content: str) -> str:
        """Create a bullet-point summary of the article"""

        if not self.client:
            raise Exception("OpenAI API key not configured")

        # Truncate content if it's too long
        max_content_length = 4000
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        prompt = f"""
        Please provide a bullet-point summary of the following article.
        Focus on the main points and key insights.
        Use clear, concise bullet points.

        Article content:
        {content}

        Bullet-point summary:
        """

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._make_openai_request,
                prompt,
                800  # Shorter for bullet points
            )

            return response.strip()

        except Exception as e:
            raise Exception(f"Failed to create bullet-point summary: {str(e)}")

    async def extract_key_points(self, content: str) -> str:
        """Extract key points and insights from the article"""

        if not self.client:
            raise Exception("OpenAI API key not configured")

        # Truncate content if it's too long
        max_content_length = 4000
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        prompt = f"""
        Extract the key points and main insights from the following article.
        Focus on the most important information and actionable insights.

        Article content:
        {content}

        Key points and insights:
        """

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._make_openai_request,
                prompt,
                600  # Shorter for key points
            )

            return response.strip()

        except Exception as e:
            raise Exception(f"Failed to extract key points: {str(e)}")

    async def create_detailed_notes(self, content: str, title: str = "") -> str:
        """Create comprehensive detailed notes from webpage content"""

        if not self.client:
            raise Exception("OpenAI API key not configured")

        # Truncate content if it's too long
        max_content_length = 8000  # Increased for detailed notes
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        prompt = f"""
        You are an expert note-taker tasked with creating comprehensive, detailed notes from web content.
        Create thorough study notes that capture all important information, concepts, and insights.

        INSTRUCTIONS:
        1. Create detailed, well-structured notes that someone could use to fully understand the topic
        2. Include all key concepts, definitions, examples, and explanations
        3. Organize information hierarchically with main topics and subtopics
        4. Preserve important details, data, statistics, quotes, and specific information
        5. Include any actionable insights, recommendations, or practical applications
        6. Use clear, academic note-taking style
        7. Format as bullet points and sub-bullets for easy reading

        STRUCTURE YOUR NOTES:
        - Main Topic/Overview (1-2 sentences)
        - Key Concepts & Definitions
        - Detailed Explanations & Examples
        - Important Data/Statistics/Facts
        - Actionable Insights/Recommendations
        - Additional Context/Background

        {f"Article Title: {title}" if title else ""}

        Content to analyze:
        {content}

        DETAILED NOTES:
        """

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._make_detailed_notes_request,
                prompt
            )

            return response.strip()

        except Exception as e:
            raise Exception(f"Failed to create detailed notes: {str(e)}")

    def _make_detailed_notes_request(self, prompt: str) -> str:
        """Make OpenAI API request optimized for detailed notes"""
        if not self.client:
            raise Exception("OpenAI API key not provided")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert academic note-taker and research assistant. Your specialty is creating comprehensive, detailed notes that capture all important information from web content.

Your notes should be:
- Thorough and comprehensive
- Well-organized with clear hierarchy
- Include all key details, examples, and context
- Written in clear, academic language
- Formatted with bullets and sub-bullets
- Focused on understanding and retention

Always preserve important specifics like numbers, dates, names, technical terms, and examples."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1500,  # Increased for detailed content
                temperature=0.2,  # Lower for more consistent, factual notes
                top_p=0.9,
                presence_penalty=0.1,  # Encourage comprehensive coverage
                frequency_penalty=0.1   # Reduce repetition
            )

            return response.choices[0].message.content

        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

    def is_configured(self) -> bool:
        """Check if OpenAI is properly configured"""
        return self.client is not None