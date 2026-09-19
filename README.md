# Image Stylizer

An AI-powered image stylization tool that transfers visual styles from one image to another using ComfyUI and Ollama.

## Project Structure

```
.
├── src/
│   ├── server.ts        # Main Express server
│   ├── comfy.ts         # ComfyUI integration
│   └── ollama.ts        # Ollama integration
├── tests/               # Test files (moved here from src/)
├── client/              # React frontend dashboard
└── uploads/             # Temporary upload directory
```

## Features

- Style analysis using Ollama
- Image stylization with ComfyUI + FLUX.2 Klein
- Web-based dashboard for easy interaction
- RESTful API endpoints for integration

## Setup

### Backend

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run dev
```

The server will be available at `http://localhost:3000`

### Frontend

1. Navigate to client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3001`

## API Endpoints

- `GET /` - Server status
- `POST /api/analyze-style` - Analyze style of an image
- `POST /api/style-transfer` - Transfer style between images

## Requirements

- Node.js >= 20
- Ollama
- ComfyUI running on port 8188