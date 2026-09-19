#!/bin/bash

# Start the image stylizer server
echo "Starting Image Stylizer Server..."

# Check if Ollama is running
if ! pgrep -f "ollama serve" > /dev/null; then
  echo "⚠️  Ollama is not running. Please start it with 'ollama serve'"
  echo "You can install Ollama from https://ollama.com/download"
  exit 1
fi

# Check if ComfyUI is running
if ! nc -z localhost 8188; then
  echo "⚠️  ComfyUI is not running on port 8188"
  echo "Please start ComfyUI before running this server"
  exit 1
fi

# Install dependencies if needed
echo "Installing dependencies..."
npm install

# Start the server
echo "Starting server on http://localhost:3000"
npm run dev