# Security Tools Configuration

This document tracks the security tools enabled for the THALE repository.

## ✅ Currently Enabled

### 1. Dependabot (Enabled)
- **Status**: ✅ Active
- **Configuration**: `.github/dependabot.yml`
- **Schedule**: Weekly checks (Mondays at 6 AM UTC)
- **Scope**: 
  - Python dependencies (`backend/requirements.txt`)
  - NPM dependencies (`frontend/package.json`)
  - GitHub Actions versions
  - Docker base images
- **Auto-merge**: Configured for patch/minor updates
- **Cost**: Free (included in GitHub)

### 2. Trivy Vulnerability Scanning (Enabled)
- **Status**: ✅ Active
- **Configuration**: `.github/workflows/security.yml`
- **Frequency**: 
  - On every push to `main`
  - On every pull request
  - Weekly scheduled scan (Mondays 6 AM UTC)
  - Manual trigger available
- **Scans**:
  - Backend container (CUDA base image)
  - Frontend container (Node + Nginx)
  - Python dependencies (pip-audit)
  - NPM dependencies (npm audit)
- **Results**: Uploaded to GitHub Security tab (SARIF format)
- **Cost**: Free (open source)

### 3. GitHub Security Alerts (Enabled)
- **Status**: ✅ Active (default for public repos)
- **Features**:
  - Dependency vulnerability alerts
  - Automatic security updates via Dependabot
  - Security advisories
- **Cost**: Free

## 🔧 Recommended: GitHub Advanced Security (GHAS)

### Benefits of Enabling GHAS

#### Code Scanning (CodeQL)
- **What**: Scans source code for vulnerabilities and coding errors
- **Languages**: Python, JavaScript/TypeScript
- **Benefits**:
  - Finds SQL injection, XSS, path traversal, etc.
  - Custom queries for organization-specific patterns
  - Automatic PR comments with findings
- **Configuration**: `.github/workflows/codeql.yml` (auto-generated)

#### Secret Scanning
- **What**: Detects committed secrets (API keys, tokens, passwords)
- **Benefits**:
  - Prevents credential leaks
  - Custom patterns for Fremtind-specific secrets
  - Partner patterns (AWS, Azure, GitHub tokens, etc.)
  - Automatic notifications to secret owners
- **Cost**: Included in GHAS license

#### Dependency Review
- **What**: Reviews dependency changes in pull requests
- **Benefits**:
  - Shows new vulnerabilities introduced by dependency updates
  - License compliance checking
  - Blocks PRs with high-severity vulnerabilities (configurable)

### GHAS License Cost

- **Fremtind Enterprise**: Contact @fremtind/informasjonssikkerhet
- **Recommended**: Enable for all production repositories
- **Process**: Tag @fremtind/informasjonssikkerhet in issue #3

## 📊 Current Security Posture

| Tool | Status | Coverage |
|------|--------|----------|
| Dependabot | ✅ Enabled | Dependencies, Actions, Docker |
| Trivy Scanning | ✅ Enabled | Containers, OS packages |
| Security Alerts | ✅ Enabled | Known vulnerabilities |
| Code Scanning (CodeQL) | ⏳ Recommended | Source code analysis |
| Secret Scanning | ⏳ Recommended | Credential leak prevention |
| Dependency Review | ⏳ Recommended | PR dependency checks |

## 🎯 Recommendations

### Immediate Actions (Free)
- [x] Enable Dependabot ✅ Done
- [x] Configure Trivy scanning ✅ Done
- [x] Create SECURITY.md ✅ Done
- [ ] Enable branch protection on `main` (requires repo admin)

### Short-term (Requires GHAS License)
- [ ] Enable Code Scanning (CodeQL)
- [ ] Enable Secret Scanning
- [ ] Configure Dependency Review enforcement

### Configuration Steps for GHAS

Once license is approved:

1. **Enable Code Scanning**:
   ```bash
   # GitHub will auto-detect languages and suggest config
   # Go to: Settings → Code security and analysis → Set up Code scanning
   ```

2. **Enable Secret Scanning**:
   ```bash
   # Settings → Code security and analysis → Enable Secret scanning
   # Configure custom patterns if needed
   ```

3. **Configure Dependency Review**:
   ```yaml
   # Add to .github/workflows/dependency-review.yml
   # Blocks PRs with high/critical vulnerabilities
   ```

## 📧 Next Steps

### For Issue #3 Resolution:

1. **Current State**: Dependabot + Trivy already enabled ✅
2. **Decision Needed**: Enable GitHub Advanced Security?
3. **Contact**: Tag @fremtind/informasjonssikkerhet in issue
4. **Ask**: "Can we enable GHAS for nice-thale? It's a production app handling sensitive data."

### Sample Comment for Issue #3:

```
@fremtind/informasjonssikkerhet 

We would like to enable GitHub Advanced Security for this repository.

**Current Security Tools (Enabled)**:
- ✅ Dependabot (dependency updates)
- ✅ Trivy scanning (container vulnerabilities)
- ✅ Security alerts

**Requested**:
- Code Scanning (CodeQL) - source code vulnerability detection
- Secret Scanning - prevent credential leaks
- Dependency Review - PR-level dependency security checks

**Rationale**:
- Production application handling audio transcriptions
- Processes potentially sensitive meeting recordings
- Integrates with AWS Bedrock (GenAI)
- Deployed to Fremtind Kubernetes (Shifter)

Can you assist with GHAS license allocation for this repo?
```

## 📚 Resources

- [Fremtind GHAS Documentation](https://confluence.intern.sparebank1.no/x/DwQaUg)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security/getting-started/github-security-features)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)

---

**Last Updated**: 2025-01-21  
**Owner**: NICE-Dokument Team  
**Security Lead**: Torstein Knutson
