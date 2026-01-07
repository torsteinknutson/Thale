# THALE - Implementation Plan

> **Speech-to-Text Transcription App for Fremtind Forsikring**  
> _Browser-based meeting transcription with AI-powered summarization_

---

## Executive Summary

THALE is an internal web application enabling Fremtind employees to transcribe meeting recordings using OpenAI's Whisper model (NB-Whisper variant for Norwegian). The app runs on GPU-enabled Docker containers in AWS and includes AI summarization via AWS Bedrock.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Phase 1: Project Setup & Foundation](#4-phase-1-project-setup--foundation)
5. [Phase 2: Backend Development](#5-phase-2-backend-development)
6. [Phase 3: Frontend Development](#6-phase-3-frontend-development)
7. [Phase 4: Real-Time Features](#7-phase-4-real-time-features)
8. [Phase 5: AWS Infrastructure & Docker](#8-phase-5-aws-infrastructure--docker)
9. [Phase 6: CI/CD Pipeline](#9-phase-6-cicd-pipeline)
10. [Phase 7: Testing & Documentation](#10-phase-7-testing--documentation)
11. [Timeline Estimate](#11-timeline-estimate)
12. [Risk Considerations](#12-risk-considerations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AWS Cloud                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────────────────────────────────────┐ │
│  │   Route 53  │───▶│              Application Load Balancer      │ │
│  └─────────────┘    └─────────────────────────────────────────────┘ │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                       │
│  ┌───────────────────┐           ┌───────────────────────────────┐  │
│  │   Frontend (S3    │           │   Backend (ECS/Fargate or     │  │
│  │   + CloudFront)   │           │   EC2 with GPU instances)     │  │
│  │                   │           │                               │  │
│  │   React + Jøkul   │◀─────────▶│   FastAPI                     │  │
│  │   Design System   │   REST/    │   - Whisper Transcription     │  │
│  └───────────────────┘  WebSocket │   - AWS Bedrock Integration   │  │
│                                   └───────────────────────────────┘  │
│                                              │                       │
│                              ┌───────────────┴───────────────┐      │
│                              ▼                               ▼       │
│                   ┌─────────────────┐           ┌─────────────────┐ │
│                   │   AWS Bedrock   │           │   S3 (Audio     │ │
│                   │   (Claude LLM)  │           │   Storage)      │ │
│                   └─────────────────┘           └─────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Frontend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **React 19** | Your experience + Jøkul components are React-based |
| Build Tool | **Vite** | Fast HMR, modern bundling (already used in DOKAI) |
| Design System | **Jøkul** (`@fremtind/jokul-*`) | Fremtind's official design system |
| State Management | React Context + hooks | Sufficient for this app's complexity |
| Audio Recording | Web Audio API + MediaRecorder | Native browser APIs |
| HTTP Client | Fetch API | Native, no dependencies needed |
| Styling | Jøkul CSS/SCSS | Follows Fremtind brand guidelines |

### Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **FastAPI** | Your experience + async support + WebSocket support |
| ML Model | **NB-Whisper Large** (`NbAiLab/nb-whisper-large`) | Optimized for Norwegian (from NBWhisper) |
| ML Libraries | PyTorch, Transformers, Librosa | Reuse from NBWhisper |
| LLM Integration | **AWS Bedrock** (Claude Sonnet 4.5) | Reuse from DOKAI |
| WebSocket | FastAPI WebSocket | Real-time transcription streaming |
| File Upload | `python-multipart` | Already used in DOKAI |

### Infrastructure
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Containerization | **Docker** | Consistent deployment |
| GPU Runtime | NVIDIA Container Toolkit | Required for Whisper on GPU |
| Cloud Provider | **AWS** | Company standard |
| Compute | EC2 (p3/g4dn) or ECS with GPU | GPU required for Whisper |
| Storage | S3 | Audio file storage |
| CDN | CloudFront | Frontend distribution |
| CI/CD | **GitHub Actions** | Automated deployment |

---

## 3. Project Structure

```
THALE/
├── .github/
│   └── workflows/
│       ├── backend-ci.yml          # Backend CI/CD pipeline
│       └── frontend-ci.yml         # Frontend CI/CD pipeline
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Environment configuration
│   │   ├── models.py               # Pydantic models
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── transcription.py    # File upload & transcription endpoints
│   │   │   ├── streaming.py        # WebSocket real-time transcription
│   │   │   └── summarization.py    # AWS Bedrock summarization
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── whisper_service.py  # Whisper model wrapper
│   │       ├── bedrock_service.py  # AWS Bedrock client (from DOKAI)
│   │       └── audio_processor.py  # Audio chunking & preprocessing
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── FileUpload.jsx
│   │   │   ├── AudioRecorder.jsx
│   │   │   ├── TranscriptionResult.jsx
│   │   │   ├── SummaryPanel.jsx
│   │   │   └── ProgressIndicator.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── TranscribePage.jsx
│   │   │   └── HistoryPage.jsx (optional)
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.js
│   │   │   └── useWebSocket.js
│   │   └── services/
│   │       └── api.js
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── infrastructure/
│   ├── docker-compose.yml          # Local development
│   ├── docker-compose.gpu.yml      # GPU-enabled local dev
│   └── aws/
│       ├── cloudformation/         # Or Terraform
│       │   ├── vpc.yml
│       │   ├── ecs.yml
│       │   └── frontend.yml
│       └── scripts/
│           └── deploy.sh
│
├── docs/
│   ├── SETUP.md                    # Local development setup
│   ├── DEPLOYMENT.md               # AWS deployment guide
│   ├── API.md                      # API documentation
│   └── ARCHITECTURE.md             # Detailed architecture docs
│
├── IMPLEMENTATION_PLAN.md          # This file
├── README.md
└── .gitignore
```

---

## 4. Phase 1: Project Setup & Foundation

### 4.1 Repository Initialization
- [ ] Initialize Git repository
- [ ] Create `.gitignore` (Python, Node, IDE files)
- [ ] Create `README.md` with project overview
- [ ] Set up branch protection rules

### 4.2 Backend Project Setup
- [ ] Create `backend/` directory structure
- [ ] Create `requirements.txt`:
  ```
  # Core
  fastapi>=0.121.3
  uvicorn[standard]
  python-dotenv
  pydantic>=2.0
  python-multipart
  
  # ML/Whisper
  torch>=2.9.0
  transformers>=4.57.1
  librosa>=0.10.0
  soundfile>=0.12.0
  
  # AWS
  boto3
  
  # WebSocket
  websockets
  ```
- [ ] Create `.env.example` with required variables
- [ ] Set up Python virtual environment

### 4.3 Frontend Project Setup
- [ ] Initialize Vite + React project:
  ```bash
  cd frontend
  npx -y create-vite@latest ./ --template react
  ```
- [ ] Install Jøkul dependencies:
  ```bash
  npm install @fremtind/jokul-core @fremtind/jokul-button-react @fremtind/jokul-text-input-react @fremtind/jokul-loader-react @fremtind/jokul-message-react @fremtind/jokul-card-react @fremtind/jokul-icons-react
  ```
- [ ] Configure Jøkul styling in `index.css`:
  ```css
  @import "@fremtind/jokul-core/core.min.css";
  /* Import other component styles as needed */
  ```

---

## 5. Phase 2: Backend Development

### 5.1 Core FastAPI Application
- [ ] Create `main.py` with CORS configuration
- [ ] Create `config.py` for environment variables
- [ ] Set up logging with structured output

### 5.2 Whisper Transcription Service
- [ ] Port transcription logic from `NBWhisper/transcribe_long.py`:
  ```python
  # Key components to adapt:
  - Model loading with GPU detection
  - Chunked audio processing (30-second segments)
  - Progress reporting via callbacks
  ```
- [ ] Create `/api/transcribe` endpoint for file uploads
- [ ] Implement chunked progress updates via Server-Sent Events (SSE)

### 5.3 AWS Bedrock Integration
- [ ] Port `BedrockService` from `DOKAI/backend/services/llm_bedrock.py`
- [ ] Create `/api/summarize` endpoint
- [ ] Configure AWS profile/credentials handling

### 5.4 API Endpoints Summary
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transcribe` | Upload audio file, returns transcription |
| POST | `/api/transcribe/stream` | Upload with SSE progress updates |
| WS | `/api/transcribe/realtime` | WebSocket for real-time transcription |
| POST | `/api/summarize` | Generate summary from text |
| GET | `/api/health` | Health check endpoint |

---

## 6. Phase 3: Frontend Redesign (Single Page Dashboard)

### 6.1 Unified Dashboard Layout
- [ ] Refactor to single-page application (SPA) structure
- [ ] Create a modern, premium "Dashboard" layout
- [ ] Integrate Recording, Upload, and Results into one cohesive view
- [ ] Implement "Glassmorphism" design aesthetic with Jøkul components

### 6.2 Enhanced Audio Recorder
- [ ] Add real-time Volume/Gain meter (Canvas/Web Audio API)
- [ ] prominent Record/Stop controls
- [ ] Live transcription text stream display

### 6.3 Transcription & Processing Area
- [ ] Editable text area for transcription results
- [ ] "Copy to Clipboard" functionality with visual feedback
- [ ] "Process with AI" button (AWS Bedrock integration)
- [ ] Summary/Analysis display panel

### 6.4 AWS Bedrock Integration (Frontend)
- [ ] Connect to `/api/summarize` endpoint
- [ ] Implement processing states (Loading, Success, Error)
- [ ] Display formatted AI response (Markdown support)

---

## 7. Phase 4: Real-Time Features & Polish

### 7.1 Audio Visualization
- [ ] Implement smooth waveform or bar visualizer
- [ ] Ensure high-performance rendering (requestAnimationFrame)

### 7.2 WebSocket Optimization
- [ ] Optimize streaming latency
- [ ] Handle connection drops gracefully

### 7.3 Progressive Display
- [ ] Display partial transcription as it's generated
- [ ] Smooth text updates without flicker
- [ ] Final transcription polish on completion

---

## 8. Phase 5: AWS Infrastructure & Docker

### 8.1 Docker Configuration
- [ ] Create `backend/Dockerfile`:
  ```dockerfile
  FROM nvidia/cuda:12.1-runtime-ubuntu22.04
  
  # Install Python and dependencies
  RUN apt-get update && apt-get install -y \
      python3.11 python3-pip libsndfile1 ffmpeg
  
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  
  # Pre-download model
  RUN python -c "from transformers import WhisperProcessor, WhisperForConditionalGeneration; \
      WhisperProcessor.from_pretrained('NbAiLab/nb-whisper-large'); \
      WhisperForConditionalGeneration.from_pretrained('NbAiLab/nb-whisper-large')"
  
  COPY ./app /app/app
  
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```
- [ ] Create `frontend/Dockerfile` for nginx static serving
- [ ] Create `docker-compose.yml` for local development

### 8.2 AWS Infrastructure
- [ ] **VPC Setup**: Private subnets for backend, public for ALB
- [ ] **EC2 with GPU**: 
  - Instance type: `g4dn.xlarge` (1 T4 GPU, cost-effective)
  - Or `p3.2xlarge` for higher performance
- [ ] **S3 Bucket**: For temporary audio storage
- [ ] **ECR**: Container registry for Docker images
- [ ] **CloudFront + S3**: Frontend distribution
- [ ] **Application Load Balancer**: HTTPS termination, routing

### 8.3 AWS Resource Estimates
| Resource | Specification | Est. Monthly Cost |
|----------|---------------|-------------------|
| EC2 g4dn.xlarge | 4 vCPU, 16GB RAM, 1 T4 GPU | ~$350-450 (on-demand) |
| S3 | Audio storage (50GB) | ~$5 |
| CloudFront | CDN for frontend | ~$10 |
| ALB | Load balancer | ~$20 |
| ECR | Container images | ~$5 |
| **Total** | | **~$400-500/month** |

> **Cost Optimization**: Use Spot Instances for ~70% savings, or consider AWS Batch for on-demand processing.

---

## 9. Phase 6: CI/CD Pipeline

### 9.1 GitHub Actions Workflow - Backend
```yaml
# .github/workflows/backend-ci.yml
name: Backend CI/CD

on:
  push:
    branches: [main]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt
      - run: pytest backend/tests/

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -t thale-backend backend/
          docker tag thale-backend:latest $ECR_REPO:latest
          docker push $ECR_REPO:latest
      # Trigger ECS deployment or EC2 update
```

### 9.2 GitHub Actions Workflow - Frontend
```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI/CD

on:
  push:
    branches: [main]
    paths: ['frontend/**']
  pull_request:
    branches: [main]
    paths: ['frontend/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci && npm run build
      
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      - run: |
          cd frontend && npm ci && npm run build
          aws s3 sync dist/ s3://$S3_BUCKET --delete
          aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

### 9.3 Required GitHub Secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `ECR_REPOSITORY_URL`
- `S3_FRONTEND_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

---

## 10. Phase 7: Testing & Documentation

### 10.1 Backend Testing
- [ ] Unit tests for `whisper_service.py`
- [ ] Integration tests for API endpoints
- [ ] Mock tests for Bedrock integration

### 10.2 Frontend Testing
- [ ] Component tests with React Testing Library
- [ ] E2E tests with Playwright or Cypress (optional)

### 10.3 Documentation
- [ ] `docs/SETUP.md`: Local development guide
- [ ] `docs/DEPLOYMENT.md`: Complete AWS deployment steps
- [ ] `docs/API.md`: OpenAPI/Swagger documentation
- [ ] Update `README.md` with quick start guide

---

## 11. Timeline Estimate

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 1 | Project Setup | 1 day |
| Phase 2 | Backend Development | 3-4 days |
| Phase 3 | Frontend Development | 3-4 days |
| Phase 4 | Real-Time Features | 2-3 days |
| Phase 5 | Docker & AWS Infrastructure | 2-3 days |
| Phase 6 | CI/CD Pipeline | 1 day |
| Phase 7 | Testing & Documentation | 2 days |
| **Total** | | **~2-3 weeks** |

> **Note**: Timeline assumes full-time development. Adjust based on availability.

---

## 12. Risk Considerations

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| GPU availability in AWS | High | Request limit increase early; consider reserved instances |
| Whisper model size (~3GB) | Medium | Pre-bake model into Docker image; use EFS for shared storage |
| WebSocket connection stability | Medium | Implement reconnection logic; fallback to SSE |
| Browser audio API compatibility | Low | Use well-supported MediaRecorder API; document browser requirements |

### Security Considerations
- [ ] Implement authentication (integrate with Fremtind SSO if available)
- [ ] Rate limiting on transcription endpoints
- [ ] Audio file cleanup after processing
- [ ] HTTPS everywhere
- [ ] AWS IAM roles with least privilege

### Performance Considerations
- [ ] Queue system for concurrent requests (consider Celery/Redis or SQS)
- [ ] Audio file size limits (recommended: 500MB max)
- [ ] Long-running transcription timeout handling (consider background jobs)

---

## Next Steps

1. **Review this plan** - Confirm technology choices and scope
2. **Start Phase 1** - Set up the project structure
3. **Prioritize MVP** - File upload + transcription first, then real-time features

---

*Last updated: 2025-01-07*
