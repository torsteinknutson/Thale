# THALE

> **Speech-to-Text Transcription App for Fremtind Forsikring**

A browser-based application for transcribing meeting recordings using OpenAI's Whisper model (NB-Whisper variant optimized for Norwegian), with AI-powered summarization via AWS Bedrock.

## Features

- **File Upload**: Upload audio files (.m4a, .wav, .mp3, etc.) for transcription
- **Live Recording**: Record audio directly in the browser
- **AI Summarization**: Generate meeting summaries using AWS Bedrock (Claude)
- **Web-Based**: No software installation required - runs entirely in the browser
- **Fremtind Design**: Built with the [Jøkul Design System](https://jokul.fremtind.no/)

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

#### Linux/macOS

1. **Clone the repository**
   ```bash
   git clone https://github.com/torsteinknutson/Thale.git
   cd Thale
   ```

2. **Backend setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

#### Windows (Corporate Environment)

> **Note**: Windows setup uses esbuild-wasm for compatibility with corporate security policies.

1. **Clone the repository**
   ```powershell
   git clone https://github.com/torsteinknutson/Thale.git
   cd Thale
   ```

2. **Backend setup**
   ```powershell
   # Install dependencies
   create venv
   pip install -r backend/requirements.txt
   
   # Start backend server
   python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
   ```

3. **Frontend setup**
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
   Or from root:
   ```powershell
   npm run dev --prefix frontend
   ```

4. **AWS Authentication**
   ```powershell
   aws sso login --profile nice-dev
   ```

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed development roadmap
- [Development Log](./DEVLOG.md) - Chronological development checkpoints
- [Setup Guide](./docs/SETUP.md) - Local development setup (Linux)
- [Windows Setup] - See above Quick Start section
- [Deployment Guide](./docs/DEPLOYMENT.md) - AWS deployment *(coming soon)*
- [API Documentation](./docs/API.md) - REST API reference *(coming soon)*

## Project Status

**Core Features Functional** - Live transcription, file upload, and AI summarization working  
**In Progress** - AWS deployment and production optimization  
See [DEVLOG.md](./DEVLOG.md) for detailed progress



## Future Vision: Organizational Knowledge Management

Thale is designed to evolve beyond a simple transcription tool into a comprehensive **knowledge capture and curation platform** for Fremtind.

### Planned Capabilities

#### 🔐 User Authentication & Personal Storage
- **AWS IAM Integration**: Secure login via Fremtind's existing IAM infrastructure
- **Individual Workspaces**: Each user maintains private recordings and notes
- **Personalized Settings**: Custom prompts, preferences, and configurations

#### 📚 Knowledge Base Integration
- **Semi-Curated Content**: Users review and refine AI-generated summaries before sharing
- **Dual Storage Model**:
  - **Private Knowledge Base**: Personal recordings and notes
  - **Shared Knowledge Base**: Team/organizational knowledge accessible to relevant groups
  - **Flexible Promotion**: Move content from private to shared as needed
- **RAG System**: Searchable vector database of meeting summaries and decisions

#### 🎯 Use Cases

**Capture Institutional Knowledge**  
Every day, 1-2 hour meetings occur across Fremtind containing critical insights about:
- Technical implementations and architecture decisions
- Product strategy and customer insights
- Process improvements and best practices
- Expert knowledge from mentoring sessions

Currently, this knowledge lives only in participants' notes (if any). Thale enables:
- **Recording** important discussions with colleagues or leaders
- **Curating** the content using AI-powered summarization
- **Sharing** knowledge to private or common knowledge bases
- **Discovering** relevant past discussions when facing similar challenges

**Enable Organizational Learning**  
- New employees access curated onboarding sessions
- Teams search for past decisions and their context
- Cross-department knowledge sharing and collaboration
- Compliance and audit trail for regulatory requirements
- Machine learning and AI capabilities on many meeting notes unlocks great potential

## License

Internal use only - Fremtind Forsikring

---
