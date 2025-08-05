#!/bin/bash

# SummarizeIt Backend Startup Script

echo "Starting SummarizeIt Backend..."

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to backend directory
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp env.example .env
    echo "Please edit .env file with your actual API keys and credentials"
fi

# Start the server
echo "Starting FastAPI server..."
echo "Server will be available at http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

python main.py