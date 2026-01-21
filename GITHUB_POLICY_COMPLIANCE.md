# GitHub Policy Compliance - Fremtind Standards

## 📋 Policy Requirements

Based on Fremtind's standard GitHub rules ([Confluence Basecamp](https://fremtind.atlassian.net/wiki/spaces/Basecamp/pages/1517125690)):

### Mandatory for all Fremtind repositories:

1. ✅ **Branch protection enabled** on default branch (`main`)
   - No direct pushes allowed
   - All changes must go through pull requests

2. ✅ **Code review required**
   - Minimum 1 approving review before merge
   - Ensures quality and knowledge sharing

### Exemptions:
- Repositories with prefix: `private-`, `poc-`, `aktuar-`
- Custom exemptions (requires level 3 leader approval)

---

## 🔍 fremtind/nice-thale Compliance Status

### Repository Information:
- **Organization**: fremtind
- **Name**: nice-thale
- **Default Branch**: `main`
- **Type**: Production application (AWS deployment)
- **Policy Applies**: ✅ YES (Fremtind org, no exempt prefix)

### ✅ Compliance Checklist:

**Required (Fremtind Policy)**:
- [ ] Branch protection enabled on `main`
- [ ] Require pull request before merging
- [ ] Require approvals: Minimum 1
- [ ] Block direct pushes to `main`

**Recommended (Best Practice)**:
- [ ] Required status checks configured
- [ ] Dismiss stale approvals on new commits
- [ ] Require conversation resolution before merge
- [ ] Include administrators in restrictions
- [ ] CODEOWNERS file for automatic review assignment

---

## 🛠️ How to Verify Compliance

### Manual Verification:

1. Navigate to: https://github.com/fremtind/nice-thale/settings/branches
2. Check for "Branch protection rules" on `main` branch
3. Verify settings:
   - ✅ "Require a pull request before merging"
   - ✅ "Require approvals: 1"
   - ✅ "Do not allow bypassing the above settings"

### Expected Configuration:

```yaml
Branch: main
Protection Rules:
  - Require pull request before merging: YES
  - Required approving reviews: 1 (minimum)
  - Dismiss stale approvals: RECOMMENDED
  - Require status checks: RECOMMENDED
    - build
    - security-scan (Trivy)
  - Require conversation resolution: RECOMMENDED
  - Include administrators: RECOMMENDED
  - Restrict push access: RECOMMENDED (CI/CD only)
```

---

## 🚨 Emergency Releases (Nød- og helgereleaser)

### When you need to bypass protection rules:

1. **Request IAM Access**:
   - Access name: **"Rolle Github Release Duty Team PIM"**
   - Located under: "Selvbetjent Aktivering"
   - Requested by: Your direct manager

2. **Activate Access When Needed**:
   - Go to: [IAM Selvbetjent Aktivering](https://iam.intern.fremtind.no/ManageSelfServiceAccess.aspx)
   - Click **Aktiver** on "Github Release Duty Team PIM"
   - Select duration (max 72 hours)
   - Provide justification

3. **Important**:
   - ⏰ IAM-GitHub sync happens every 30 minutes
   - Activate early to ensure access when needed
   - You become member of [Release Duty Team](https://github.com/orgs/fremtind/teams/release-duty-team)
   - Check team page for last sync timestamp

---

## 🤖 CI/CD with Protected Branches

### Problem:
GitHub Actions workflows that push to `main` will fail with branch protection enabled.

### Solution: action-chorebot-auth

Use [action-chorebot-auth](https://github.com/fremtind/action-chorebot-auth) for workflows that need write access to protected branches.

**What it does**:
- Creates tokens with write permissions on protected branches
- Allows CI/CD to commit while maintaining protection rules

**Example use cases**:
- Automated version bumps
- Dependency updates
- Generated documentation
- Build artifacts commits

**How to use**:
- Follow README in [fremtind/action-chorebot-auth](https://github.com/fremtind/action-chorebot-auth)
- Ensure team has proper understanding of the action

---

## 📊 Current PR #157750 Status

### Compliance with Policy:

✅ **Follows proper workflow**:
- Created pull request (not direct push)
- Has 2/3 required approvals
- Awaiting final review from Tore
- All code review comments addressed

✅ **Best practices**:
- Detailed description of changes
- Multiple reviewers engaged
- Code review feedback incorporated
- CI/CD pipeline configured

---

## 🎯 Action Items for nice-thale

### Immediate Actions:
1. [ ] **CRITICAL**: Verify branch protection is enabled on `main`
   - Go to repo settings → Branches
   - Confirm protection rule exists for `main`
   - If missing: Request repo admin to configure ASAP

2. [ ] **Verify CI/CD Configuration**:
   - Ensure GitHub Actions don't push directly to `main`
   - Use pull requests or `action-chorebot-auth` for automated commits
   - Check `.github/workflows/` for direct pushes

### Recommended Enhancements:
3. [ ] **Add CODEOWNERS File**:
   ```
   # CODEOWNERS for nice-thale
   # Automatically requests reviews from team members
   
   * @fremtind/nice-dokument
   /backend/ @torsteinknutson @[backend-specialist]
   /frontend/ @torsteinknutson @[frontend-specialist]
   /.github/ @torsteinknutson @[devops-specialist]
   ```

4. [ ] **Configure Required Status Checks**:
   - Add `build` as required check
   - Add `security-scan` (Trivy) as required check
   - Prevents merging if tests fail or vulnerabilities found

5. [ ] **Enable Additional Protections**:
   - Dismiss stale approvals when new commits pushed
   - Require conversation resolution before merge
   - Include administrators in restrictions
   - Require linear history (prevent merge commits)

---

## 📝 Security Enhancements Already Implemented

✅ **Production Security Hardening** (Commits 2cd2d49, 3185a40):
- Security headers (CSP, Referrer-Policy, Permissions-Policy)
- Version pinning (CUDA 12.1.0, Node 22.12.0, Nginx 1.27)
- Dependabot configuration (weekly automated updates)
- Trivy security scanning workflow
- Comprehensive security audit documentation

✅ **CI/CD Best Practices**:
- Automated build and test pipeline
- Docker image scanning
- Continue-on-error for infrastructure dependencies

✅ **Code Quality**:
- Multiple reviewer approvals on PR #157750
- Addressed all code review comments
- Production features (file validation, rate limiting, Norwegian errors)

---

## 📚 Resources

- [Fremtind GitHub Policy](https://fremtind.atlassian.net/wiki/spaces/Basecamp/pages/1517125690/Standardregler+for+branch+protection+og+code+review)
- [action-chorebot-auth](https://github.com/fremtind/action-chorebot-auth)
- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [IAM Selvbetjent Aktivering](https://iam.intern.fremtind.no/ManageSelfServiceAccess.aspx)
- [Release Duty Team](https://github.com/orgs/fremtind/teams/release-duty-team)

---

## ✅ Summary

**fremtind/nice-thale compliance status**:
- ⏳ Pending verification (need to check GitHub settings manually)
- ✅ Currently following proper PR workflow
- ✅ Security hardening implemented
- ✅ CI/CD pipeline configured
- 📋 Action: Verify branch protection settings in repo

**Next steps**:
1. Verify branch protection is enabled
2. If not enabled: Request repo admin to configure
3. Consider implementing recommended enhancements (CODEOWNERS, status checks)
4. Continue following PR workflow for all changes

---

**Updated**: 2025-01-21  
**Version**: 1.0  
**Team**: NICE-Dokument
