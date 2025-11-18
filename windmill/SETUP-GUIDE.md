# Windmill Platform Setup Guide

**Complete step-by-step guide to setting up the HomeOps Windmill IaC platform**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Windmill Server Setup](#windmill-server-setup)
3. [Workspace Configuration](#workspace-configuration)
4. [GitHub Integration](#github-integration)
5. [VS Code Extension Setup](#vs-code-extension-setup)
6. [Secrets Management](#secrets-management)
7. [Initial Deployment](#initial-deployment)
8. [Testing & Validation](#testing--validation)
9. [Troubleshooting](#troubleshooting)
10. [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure you have:

- [ ] **Windmill Server** - Self-hosted or cloud instance running
- [ ] **Git Access** - Write access to the HomeOps repository
- [ ] **VS Code** - Latest version installed
- [ ] **Node.js** - Version 18+ for local testing (optional)
- [ ] **Docker** - For local Windmill development (optional)
- [ ] **GitHub Account** - With repository admin access for secrets

### Recommended Knowledge

- Basic understanding of Git workflows
- Familiarity with YAML and TypeScript
- Understanding of Docker and containerization
- Basic knowledge of CI/CD pipelines

---

## Windmill Server Setup

### Option 1: Self-Hosted (Recommended for Production)

#### Using Docker Compose

```bash
# Create Windmill directory
mkdir -p ~/windmill
cd ~/windmill

# Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/windmill-labs/windmill/main/docker-compose.yml

# Start Windmill
docker-compose up -d

# Check status
docker-compose ps
```

**Access Windmill UI**: http://localhost:8000

#### Using Docker (Single Container)

```bash
docker run -d \
  --name windmill \
  -p 8000:8000 \
  -v windmill_data:/data \
  ghcr.io/windmill-labs/windmill:latest
```

### Option 2: Windmill Cloud

1. Go to [https://app.windmill.dev](https://app.windmill.dev)
2. Sign up for an account
3. Create a new workspace: `homeops-platform`
4. Note your workspace URL

### Post-Installation Steps

1. **Access Windmill UI**
   - Self-hosted: http://localhost:8000
   - Cloud: https://app.windmill.dev

2. **Create Admin Account**
   - Username: `admin` (or your preference)
   - Password: Use a strong password (save in password manager)

3. **Verify Installation**
   - Dashboard should load successfully
   - No error messages in console
   - Can navigate between sections

---

## Workspace Configuration

### Create Platform Workspace

1. **Navigate to Workspaces**
   - Click user menu (top right)
   - Select "Workspaces"

2. **Create New Workspace**
   - Click "+ New Workspace"
   - **Name**: `homeops-platform`
   - **ID**: `homeops-platform` (lowercase, no spaces)
   - **Description**: "HomeOps platform-level infrastructure orchestration"
   - Click "Create"

3. **Configure Workspace Settings**
   - Navigate to workspace: `homeops-platform`
   - Click "Settings" (gear icon)

   **General Settings**:
   - Auto-invite domain: (leave empty unless using email domains)
   - Auto-add new scripts: ✅ Enabled
   - Default language: TypeScript

   **Security Settings**:
   - Require approval for deployments: ✅ Enabled (for production flows)
   - Audit logging: ✅ Enabled
   - Secret encryption: ✅ Enabled

4. **Set Timezone**
   - In workspace settings, set timezone to match your location
   - Example: `America/New_York`
   - This affects scheduled workflow times

---

## GitHub Integration

### Step 1: Generate Windmill Token

1. **In Windmill UI**, click user menu > "Tokens"
2. Click "+ Create Token"
   - **Name**: `github-actions-sync`
   - **Expiration**: 1 year (or "No expiration" if allowed)
   - **Scopes**: Select "Workspace Admin" for `homeops-platform`
3. Click "Create"
4. **Copy the token immediately** (it won't be shown again)
5. Save token securely (password manager)

### Step 2: Add GitHub Repository Secrets

1. **Navigate to GitHub Repository**
   - Go to https://github.com/your-username/HomeOps
   - Click "Settings" tab
   - Click "Secrets and variables" > "Actions"

2. **Add WMILL_URL Secret**
   - Click "New repository secret"
   - **Name**: `WMILL_URL`
   - **Value**: Your Windmill server URL
     - Self-hosted: `http://your-server:8000`
     - Cloud: `https://app.windmill.dev`
   - Click "Add secret"

3. **Add WMILL_TOKEN Secret**
   - Click "New repository secret"
   - **Name**: `WMILL_TOKEN`
   - **Value**: Paste the token from Step 1
   - Click "Add secret"

### Step 3: Verify GitHub Actions Workflow

1. **Check workflow file exists**:
   ```bash
   cat .github/workflows/windmill-sync.yml
   ```

2. **Verify it contains**:
   - Trigger on `push` to `main` branch
   - Path filter: `windmill/**`
   - Uses `windmill-labs/wmill-action@v3`
   - References `WMILL_URL` and `WMILL_TOKEN` secrets

---

## VS Code Extension Setup

### Install Windmill Extension

1. **Open VS Code**
2. **Go to Extensions** (Ctrl+Shift+X or Cmd+Shift+X)
3. **Search**: "Windmill"
4. **Install**: "Windmill" by Windmill Labs
5. **Reload** VS Code if prompted

### Configure Extension

1. **Open Command Palette** (Ctrl+Shift+P or Cmd+Shift+P)
2. **Run**: `Windmill: Configure`
3. **Enter Windmill URL**:
   - Self-hosted: `http://localhost:8000`
   - Cloud: `https://app.windmill.dev`

4. **Authenticate**:
   - Option A: Use existing token (from earlier)
   - Option B: Click "Login" to generate new token

5. **Select Workspace**: `homeops-platform`

6. **Verify Connection**:
   - Open any `.ts` or `.yaml` file in `windmill/` directory
   - Should see Windmill status in bottom status bar
   - Icon should show "Connected"

### Extension Features

- **Syntax Highlighting**: For Windmill YAML flows
- **IntelliSense**: TypeScript autocomplete with Windmill SDK
- **Run Flows**: Right-click flow > "Run Flow"
- **Debug**: Step-through flow execution
- **Sync**: Manual sync to Windmill workspace

---

## Secrets Management

### Understanding Windmill Secrets

Windmill has three types of secure storage:

1. **Resources**: Structured credentials (databases, APIs)
2. **Variables**: Simple key-value pairs
3. **Environment Variables**: Workspace-wide settings

### Setting Up Resources

#### PostgreSQL Database Connection

1. **Navigate**: Windmill UI > `homeops-platform` > Resources
2. **Click**: "+ New Resource"
3. **Select Type**: "PostgreSQL"
4. **Fill Details**:
   - **Path**: `platform/postgres_main`
   - **Description**: "Main PostgreSQL database connection"
   - **Host**: `localhost` (or your DB host)
   - **Port**: `5432`
   - **Database**: `homeops`
   - **Username**: `your_user`
   - **Password**: `your_secure_password`
5. **Test Connection**: Click "Test" button
6. **Save**: Click "Create"

#### Redis Cache Connection

1. **New Resource** > "Redis"
2. **Path**: `platform/redis_cache`
3. **Description**: "Redis cache connection"
4. **Host**: `localhost`
5. **Port**: `6379`
6. **Password**: `your_redis_password`
7. **Save**

#### Slack Webhook

1. **New Resource** > "Webhook"
2. **Path**: `platform/slack_webhook`
3. **Description**: "Slack webhook for platform notifications"
4. **URL**: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`
   - Get this from Slack: https://api.slack.com/messaging/webhooks
5. **Save**

#### GitHub API Token

1. **New Resource** > "API Key"
2. **Path**: `platform/github_api_token`
3. **Description**: "GitHub API token for deployment operations"
4. **Key**: `ghp_your_github_personal_access_token`
   - Generate at: https://github.com/settings/tokens
   - Scopes needed: `repo`, `workflow`
5. **Save**

### Setting Up Variables

Variables are for non-sensitive configuration values.

1. **Navigate**: Windmill UI > `homeops-platform` > Variables
2. **Click**: "+ New Variable"

**Example Variables**:

| Path | Value | Description |
|------|-------|-------------|
| `platform/docker_host` | `unix:///var/run/docker.sock` | Docker socket path |
| `platform/github_repo` | `your-username/HomeOps` | GitHub repository |
| `platform/slack_channel` | `#homeops-alerts` | Default Slack channel |

### Setting Up Environment Variables

Workspace-wide environment variables (from `windmill.config.yaml`).

1. **Navigate**: Windmill UI > `homeops-platform` > Settings > Environment Variables
2. **Add variables**:
   ```
   PLATFORM_NAME=HomeOps
   PLATFORM_ENV=production
   TZ=America/New_York
   LOG_LEVEL=info
   HEALTH_CHECK_TIMEOUT=30
   ```

### Accessing Secrets in Scripts

#### Resources

```typescript
// In your workflow script
import * as wmill from 'windmill-client';

// Get PostgreSQL connection
const pgResource = await wmill.getResource('platform/postgres_main');
console.log('Database host:', pgResource.host);

// Get Slack webhook
const slackWebhook = await wmill.getResource('platform/slack_webhook');
```

#### Variables

```typescript
import * as wmill from 'windmill-client';

const dockerHost = await wmill.getVariable('platform/docker_host');
const githubRepo = await wmill.getVariable('platform/github_repo');
```

#### Environment Variables

```typescript
// Directly from process.env
const platformName = process.env.PLATFORM_NAME;
const logLevel = process.env.LOG_LEVEL;
```

---

## Initial Deployment

### Prepare First Workflow

We'll create a simple "Hello World" workflow to test the system.

#### 1. Create Test Script

**File**: `windmill/scripts/platform/hello-world.ts`

```typescript
/**
 * Hello World Test Script
 *
 * Simple script to verify Windmill platform is working.
 */

export async function main() {
  const platformName = process.env.PLATFORM_NAME || 'HomeOps';
  const timestamp = new Date().toISOString();

  console.log(`Hello from ${platformName}!`);
  console.log(`Current time: ${timestamp}`);

  return {
    message: `Hello from ${platformName}!`,
    timestamp,
    status: 'success'
  };
}
```

#### 2. Create Test Flow

**File**: `windmill/flows/infrastructure/test-workflow.yaml`

```yaml
summary: "Test workflow to verify platform setup"
description: |
  Simple test workflow that runs hello-world script.
  Use this to verify that the Windmill IaC platform is working correctly.

# Run manually only (no schedule)
schedule: null

steps:
  - id: hello
    summary: "Say hello"
    script:
      path: platform/hello-world
      language: typescript
      content: |
        export async function main() {
          const platformName = process.env.PLATFORM_NAME || 'HomeOps';
          const timestamp = new Date().toISOString();

          console.log(`Hello from ${platformName}!`);
          console.log(`Current time: ${timestamp}`);

          return {
            message: `Hello from ${platformName}!`,
            timestamp,
            status: 'success'
          };
        }

  - id: log_result
    summary: "Log the result"
    script:
      language: typescript
      content: |
        export async function main(hello_result: any) {
          console.log('Previous step result:', hello_result);
          return { received: hello_result };
        }
    args:
      hello_result: ${{ steps.hello.result }}
```

#### 3. Commit and Push

```bash
# Add files
git add windmill/scripts/platform/hello-world.ts
git add windmill/flows/infrastructure/test-workflow.yaml

# Commit
git commit -m "Add test workflow for platform verification"

# Push to trigger sync
git push origin main
```

#### 4. Monitor Sync

1. **Go to GitHub**:
   - Repository > Actions tab
   - Should see "Windmill IaC Sync" workflow running

2. **Check Logs**:
   - Click on the running workflow
   - Expand steps to see progress
   - Should see "✅ Sync Success Notification"

3. **Verify in Windmill**:
   - Go to Windmill UI > `homeops-platform`
   - Click "Flows" in sidebar
   - Should see `infrastructure/test-workflow`

#### 5. Run Test Workflow

1. **In Windmill UI**, click on the test workflow
2. **Click "Run"** button
3. **Watch execution**:
   - Should see both steps execute
   - Step 1: "Say hello"
   - Step 2: "Log the result"
4. **Check output**:
   - Should see console logs with "Hello from HomeOps!"
   - Result should show success status

**✅ If test succeeds, your platform is working correctly!**

---

## Testing & Validation

### Validation Checklist

- [ ] **Windmill server is accessible**
  - Can log in to Windmill UI
  - No connection errors

- [ ] **Workspace created**
  - `homeops-platform` workspace exists
  - Can navigate to workspace

- [ ] **GitHub integration working**
  - Secrets configured: `WMILL_URL`, `WMILL_TOKEN`
  - GitHub Actions workflow exists
  - Test push triggers sync

- [ ] **VS Code extension connected**
  - Extension shows "Connected"
  - Can view flows in VS Code
  - Autocomplete works in TypeScript files

- [ ] **Secrets configured**
  - At least one Resource created
  - Environment variables set
  - Can retrieve secrets in test script

- [ ] **Test workflow runs successfully**
  - Test flow synced from Git
  - Manual execution succeeds
  - Logs show expected output

### Common Issues

#### Issue: GitHub Actions sync fails

**Symptoms**: Workflow fails with authentication error

**Solution**:
1. Verify `WMILL_URL` is correct
2. Check `WMILL_TOKEN` hasn't expired
3. Ensure token has "Workspace Admin" scope
4. Try regenerating token

#### Issue: VS Code extension won't connect

**Symptoms**: Extension shows "Disconnected"

**Solution**:
1. Check Windmill server is running
2. Verify URL in extension settings
3. Try re-authenticating (Command Palette > "Windmill: Configure")
4. Check firewall/network settings

#### Issue: Workflow runs but fails

**Symptoms**: Workflow executes but steps fail

**Solution**:
1. Check workflow logs in Windmill UI
2. Verify all required resources exist
3. Check environment variables are set
4. Test script locally (if possible)
5. Check for TypeScript syntax errors

---

## Next Steps

### Immediate Actions

1. **Review Configuration**
   - Check `windmill.config.yaml` settings
   - Adjust schedules to your timezone
   - Review monitoring thresholds

2. **Set Up Monitoring**
   - Create first real workflow (e.g., Docker health check)
   - Configure Slack notifications
   - Test alert routing

3. **Read Architecture Docs**
   - Review [WORKSPACE-ARCHITECTURE.md](./WORKSPACE-ARCHITECTURE.md)
   - Understand separation between platform and subprojects
   - Plan your workflow organization

### Building Your First Real Workflow

**Suggested Starter**: Docker Health Monitoring

1. **Create script**: `scripts/platform/list-docker-services.ts`
   - Connects to Docker API
   - Lists all running containers
   - Returns service health status

2. **Create flow**: `flows/monitoring/docker-health-check.yaml`
   - Runs every 5 minutes
   - Checks all services
   - Sends alerts if unhealthy

3. **Test locally** in VS Code
4. **Commit and push** to deploy
5. **Monitor execution** in Windmill UI

### Learning Resources

- **Windmill Documentation**: https://docs.windmill.dev
- **Windmill Discord**: https://discord.gg/windmill
- **Example Workflows**: `subprojects/financial-tracker/windmill/`
- **TypeScript Guide**: https://www.typescriptlang.org/docs/

---

## Advanced Topics

### Local Development

For faster iteration, run Windmill locally:

```bash
# Start local Windmill
docker run -d \
  --name windmill-dev \
  -p 8001:8000 \
  -v $(pwd)/windmill:/data \
  ghcr.io/windmill-labs/windmill:latest

# Access at http://localhost:8001
```

### Multi-Environment Setup

Create separate workspaces:
- `homeops-platform-dev` - Development
- `homeops-platform-staging` - Staging
- `homeops-platform` - Production

Use different GitHub branches:
- `develop` branch → dev workspace
- `staging` branch → staging workspace
- `main` branch → production workspace

### CI/CD Best Practices

1. **Branch Protection**
   - Require PR reviews for `main`
   - Require status checks to pass

2. **Workflow Approval**
   - Mark critical flows as "require approval"
   - Set up approval groups in Windmill

3. **Rollback Strategy**
   - Keep previous workflow versions in Git
   - Tag stable releases: `git tag v1.0.0`
   - Can revert by deploying old Git commit

---

## Support & Troubleshooting

### Getting Help

1. **Check Logs**: Always start with logs (Windmill UI > Runs > Click run)
2. **Review Docs**: [Windmill Documentation](https://docs.windmill.dev)
3. **Search Issues**: Check GitHub Issues in HomeOps repo
4. **Community**: Windmill Discord server

### Debug Mode

Enable verbose logging:

```typescript
// In your script
export async function main() {
  console.log('DEBUG: Starting workflow');
  console.log('DEBUG: Environment:', process.env.PLATFORM_ENV);

  // Your logic here

  console.log('DEBUG: Workflow completed');
}
```

Set `LOG_LEVEL=debug` in environment variables for detailed logs.

---

## Conclusion

You should now have a fully functional Windmill IaC platform!

**What You've Accomplished**:
- ✅ Windmill server running
- ✅ `homeops-platform` workspace configured
- ✅ GitHub Actions auto-sync setup
- ✅ VS Code extension connected
- ✅ Secrets management configured
- ✅ First test workflow deployed and tested

**Next**: Start building real workflows for your HomeOps infrastructure!

---

**Last Updated**: 2025-01-15
**Guide Version**: 1.0.0
**Windmill Version**: Latest
