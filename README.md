# Noted - Chrome Extension with FastAPI Backend

A full-stack Chrome Extension that lets users summarize web articles and save them to their own Notion workspace using OpenAI GPT-3.5.

## Features

- **Chrome Extension**: Extract article content from any webpage
- **OpenAI Integration**: Summarize articles using GPT-3.5 (client-side)
- **Smart Categorization**: Automatically categorize articles into predefined topics using AI
- **Notion OAuth**: Secure connection to user's Notion workspace
- **FastAPI Backend**: RESTful API for handling OAuth and Notion operations
- **SQLite Storage**: Secure storage of user access tokens
- **Modern UI**: Clean, responsive popup interface
- **Category Organization**: Organize saved articles by topic in Notion

## Architecture

- **OpenAI API**: Called directly from the Chrome extension (client-side) for summarization and categorization
- **OpenAI API Key**: Stored securely in Chrome extension storage
- **Backend**: Handles Notion OAuth, page creation, and category organization
- **AI Categorization**: Intelligent article categorization using predefined topic categories
- **Security**: OAuth tokens stored in SQLite database

## Smart Categorization

The extension features an intelligent categorization system that automatically organizes your saved articles by topic. When you summarize an article, the AI analyzes the content and assigns it to the most appropriate category.

### Available Categories

- **Technology & AI**: Tech, AI, programming, cybersecurity
- **Sports**: Sports news, fitness, athletes
- **Business & Finance**: Business, finance, markets, economics
- **Health & Medicine**: Health, medical research, wellness
- **Science**: Research, discoveries, environment, space
- **Politics**: Government, policy, elections, international affairs
- **Entertainment**: Movies, TV, music, gaming, celebrities
- **Education**: Learning, academic content, educational tech
- **Travel & Lifestyle**: Travel, culture, food, fashion, personal development
- **General News**: Articles that don't fit other categories

### How It Works

1. **Automatic Detection**: The AI analyzes article content and title to determine the best category
2. **User Confirmation**: You can review and change the suggested category before saving
3. **Notion Organization**: Articles are saved to your Notion workspace with proper category organization
4. **Consistent Tagging**: Ensures your articles are systematically organized for easy retrieval

## Project Structure

```
Noted/
├── backend/                 # FastAPI backend
│   ├── main.py             # FastAPI entry point
│   ├── models.py           # Pydantic models
│   ├── config.py           # Configuration management
│   ├── storage.py          # SQLite token storage
│   ├── notion_oauth.py     # Notion OAuth handler
│   ├── notion_api.py       # Notion API operations
│   ├── requirements.txt    # Python dependencies
│   └── env.example        # Environment variables template
├── extension/              # Chrome Extension
│   ├── manifest.json      # Extension manifest
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # Popup functionality
│   ├── content.js        # Content script
│   └── background.js     # Service worker
└── README.md             # This file
```

## Setup Instructions

### 1. Backend Setup

#### Prerequisites
- Python 3.8+
- pip

#### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp env.example .env
```

Edit `.env` with your actual values:
```env
# Notion OAuth Configuration
NOTION_CLIENT_ID=your_notion_client_id_here
NOTION_CLIENT_SECRET=your_notion_client_secret_here
NOTION_REDIRECT_URI=http://localhost:8000/auth/notion/callback

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Security
SECRET_KEY=your-secret-key-change-this-in-production
```

5. Start the backend server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### 2. Notion OAuth Setup

1. Go to [Notion Developers](https://developers.notion.com/)
2. Create a new integration
3. Set the redirect URI to `http://localhost:8000/auth/notion/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### 3. Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension should now appear in your extensions list

## Usage

### 1. Connect to Notion

1. Click the Noted extension icon
2. Click "Connect to Notion"
3. Authorize the application in Notion
4. You'll be redirected back and see a success message

### 2. Configure OpenAI API Key

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/)
2. In the extension popup, enter your API key in the settings section
3. Click "Save Settings"

### 3. Summarize Articles

1. Navigate to any article you want to summarize
2. Click the Noted extension icon
3. Click "Summarize This Page"
4. The extension will:
   - Extract the article content
   - Send it to OpenAI for summarization and categorization (client-side)
   - Display the detected category for your confirmation
   - Allow you to change the category if needed
   - Save the summary to your Notion workspace via backend with proper categorization
5. You'll see a success message when complete, and the article will be organized under the appropriate category in Notion

## API Endpoints

### Authentication
- `GET /auth/notion/login` - Redirect to Notion OAuth
- `GET /auth/notion/callback` - Handle OAuth callback

### Notion Operations
- `POST /notion/save` - Save summary to Notion with category organization

### Summarization & Categorization
- `POST /summarize` - Summarize content using OpenAI
- `POST /summarize-and-categorize` - Summarize and categorize content automatically
- `GET /categories` - Get available categories and their descriptions

### User Management
- `GET /user/{user_id}/status` - Check user connection status

## Security Features

- **OAuth 2.0**: Secure Notion authentication
- **Token Storage**: Encrypted storage of access tokens
- **CORS**: Proper CORS configuration for Chrome extension
- **Input Validation**: Pydantic models for request validation
- **Client-side OpenAI**: API key stored securely in Chrome storage
- **Category Privacy**: Categorization happens client-side with secure API communication

## Development

### Backend Development

The backend uses FastAPI with the following key components:

- **FastAPI**: Modern, fast web framework
- **SQLite**: Lightweight database for token storage
- **Pydantic**: Data validation and settings management
- **Requests**: HTTP client for external APIs

### Extension Development

The Chrome extension uses Manifest V3 with:

- **Service Worker**: Background processing
- **Content Scripts**: Page content extraction
- **Chrome Storage**: Secure local storage for API keys
- **Chrome Scripting API**: Dynamic script injection
- **Direct OpenAI API**: Client-side summarization and categorization
- **Category UI**: Interactive category confirmation and selection interface

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the backend is running on `http://localhost:8000`
2. **Notion Connection Failed**: Check your Notion OAuth credentials
3. **OpenAI API Errors**: Verify your OpenAI API key is correct and stored in the extension
4. **Content Extraction Issues**: The extension tries multiple strategies to extract content
5. **Category Detection Issues**: If categorization fails, the article defaults to "General News"

### Debug Mode

Enable Chrome DevTools for the extension:
1. Go to `chrome://extensions/`
2. Find Noted
3. Click "Details"
4. Click "Inspect views: popup"
