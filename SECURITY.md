# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in THALE, please report it responsibly:

### Contact Information

- **Security Lead**: Torstein Knutson (torstein.knutson@fremtind.no)
- **Team**: NICE-Dokument
- **General Security Contact**: informasjonssikkerhet@fremtind.no

### Reporting Process

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Send details to the Security Lead or informasjonssikkerhet@fremtind.no
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 2 business days and provide a remediation timeline.

## Security Measures

### Automated Security

- **Dependabot**: Automated dependency updates (weekly checks)
- **Trivy Scanning**: Container vulnerability scanning on every push
- **GitHub Security Alerts**: Enabled for dependencies and code
- **Secret Scanning**: Enabled to prevent credential leaks

### Security Best Practices

1. **Authentication**: AWS Bedrock via IAM roles (no hardcoded credentials)
2. **Data Protection**: 
   - Audio files encrypted at rest (S3 server-side encryption)
   - Database connections encrypted with TLS
   - Istio mTLS for service-to-service communication
3. **Input Validation**: 
   - File type validation (audio formats only)
   - File size limits (max 100MB)
   - Rate limiting (10 requests/minute per IP)
4. **Network Security**:
   - Network policies restrict pod-to-pod communication
   - Ingress restricted to internal office network
5. **Container Security**:
   - Pinned base image versions
   - Non-root user execution
   - Read-only root filesystem where possible
6. **Monitoring**: Humio logging and Prometheus metrics for security events

### Dependency Management

- Python dependencies: `backend/requirements.txt` (pinned versions)
- JavaScript dependencies: `frontend/package.json` with `package-lock.json`
- Weekly automated updates via Dependabot
- Container base images pinned to specific versions

### Regular Security Activities

- Weekly Dependabot security updates review
- Trivy vulnerability scans on every commit
- Security audit documentation: [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- Quarterly security review by InfoSec team

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0   | :x:                |

Currently in active development. Production support begins after initial AWS deployment.

## Security Disclosure Policy

- Security vulnerabilities are treated as **confidential**
- Fixes are deployed immediately to production
- Public disclosure occurs after fix is deployed (responsible disclosure)
- Credit given to security researchers (with permission)

## Compliance

THALE complies with:
- Fremtind Information Security policies
- GDPR data protection requirements
- Norwegian financial services regulations

For questions about security compliance, contact informasjonssikkerhet@fremtind.no

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-04-21 (quarterly)
