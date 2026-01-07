# Local Development Setup

This guide covers setting up THALE for local development.

## Prerequisites

- **Python 3.11+** - For the backend
- **Node.js 22+** - For the frontend (use nvm to manage versions)
- **GPU with CUDA** - Recommended for fast transcription (CPU works but is slower)
- **AWS CLI** - Configured with appropriate credentials for Bedrock

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/torsteinknutson/Thale.git
cd Thale
```

### 2. Set Node Version (using nvm)

```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart terminal or source the config
source ~/.bashrc  # or ~/.zshrc

# Use the correct Node version
nvm use  # reads from .nvmrc
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Run the backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000

- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/health

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run the development server
npm run dev
```

The frontend will be available at http://localhost:5173

## Environment Variables

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ENV` | Environment (development/production) | development |
| `DEBUG` | Enable debug mode | true |
| `AWS_PROFILE` | AWS profile for Bedrock | nice-dev |
| `AWS_REGION` | AWS region | eu-west-1 |
| `WHISPER_MODEL_ID` | HuggingFace model ID | NbAiLab/nb-whisper-large |

### Frontend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | http://localhost:8000 |

## Testing

### Backend Tests

```bash
cd backend
pytest
```

### Frontend Tests

```bash
cd frontend
npm run lint
npm run test  # if configured
```

## Common Issues

### Node Version Mismatch

If you see errors about Node version, make sure you're using Node 22+:

```bash
nvm use 22
node --version  # Should show v22.x.x
```

### CUDA Not Available

If GPU is not detected, the app will fall back to CPU processing. Check CUDA:

```bash
python -c "import torch; print(torch.cuda.is_available())"
```

### AWS Credentials

If Bedrock integration fails, verify AWS credentials:

```bash
aws sts get-caller-identity --profile nice-dev
```
