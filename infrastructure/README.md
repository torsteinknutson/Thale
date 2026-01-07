# THALE Infrastructure

This directory contains Infrastructure as Code (IaC) and deployment scripts for the THALE application.

## AWS Architecture

The application is designed to run on AWS with the following components:

- **VPC**: Custom VPC with public and private subnets.
- **ECS (Elastic Container Service)**: Hosts the backend API.
  - Requires GPU-enabled instances (e.g., `g4dn.xlarge`) for Whisper inference.
- **S3**: Stores audio files and frontend static assets.
- **CloudFront**: Serves the frontend application.
- **Application Load Balancer (ALB)**: Routes traffic to the backend.

## Deployment

### Prerequisites
- AWS CLI installed and configured
- Docker installed
- Python 3.11+

### Directory Structure
- `aws/cloudformation/`: CloudFormation templates
- `aws/scripts/`: Helper scripts for deployment
- `docker-compose.yml`: Local development configuration

### Local Development
To run the full stack locally with GPU support:
```bash
docker-compose up --build
```

For CPU-only development:
```bash
docker-compose -f docker-compose.cpu.yml up --build
```
