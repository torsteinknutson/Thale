# THALE

> **Speech-to-Text Transcription App for Fremtind Forsikring**

A browser-based application for transcribing meeting recordings using OpenAI's Whisper model (NB-Whisper variant optimized for Norwegian), with AI-powered summarization via AWS Bedrock.

## Features

- 📤 **File Upload**: Upload audio files (.m4a, .wav, .mp3, etc.) for transcription
- 🎙️ **Live Recording**: Record audio directly in the browser with real-time transcription
- 🤖 **AI Summarization**: Generate meeting summaries using AWS Bedrock (Claude)
- 🌐 **Web-Based**: No software installation required - runs entirely in the browser
- 🎨 **Fremtind Design**: Built with the [Jøkul Design System](https://jokul.fremtind.no/)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + Jøkul Design System |
| Backend | FastAPI (Python) |
| ML Model | NbAiLab/nb-whisper-large |
| LLM | AWS Bedrock (Claude Sonnet) |
| Infrastructure | Docker + AWS (GPU instances) |
| CI/CD | GitHub Actions |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized development)
- AWS CLI configured with appropriate credentials

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/torsteinknutson/Thale.git
   cd Thale
   ```

2. **Backend setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed development roadmap
- [Setup Guide](./docs/SETUP.md) - Local development setup *(coming soon)*
- [Deployment Guide](./docs/DEPLOYMENT.md) - AWS deployment *(coming soon)*
- [API Documentation](./docs/API.md) - REST API reference *(coming soon)*

## Project Status

🚧 **Under Development** - See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for current progress.

## License

Internal use only - Fremtind Forsikring

---

