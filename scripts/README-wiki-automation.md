# GitHub Wiki Automation Guide

This guide explains how to programmatically update your GitHub wiki pages using various methods.

## 🔧 **Available Methods**

### **Method 1: Git Operations (Recommended)**
GitHub wikis are Git repositories, allowing direct interaction via Git commands.

#### **Quick Setup:**
```bash
# Manual update using shell script
npm run update-wiki-simple

# Advanced update using Node.js script  
npm run update-wiki
```

### **Method 2: GitHub Actions (Automated)**
Automatically update wiki on deployments, commits, or schedule.

#### **Triggers:**
- ✅ **Push to main** - When wiki-pages/ or package.json changes
- ✅ **Successful deployment** - After build workflow completes
- ✅ **Manual trigger** - Via GitHub Actions UI
- ✅ **Scheduled** - Daily at 6 AM UTC

### **Method 3: GitHub API** 
Limited support - wikis aren't fully covered by REST/GraphQL APIs.

---

## 📋 **Implementation Details**

### **1. Shell Script (`update-wiki.sh`)**

**Usage:**
```bash
./scripts/update-wiki.sh
# or
npm run update-wiki-simple
```

**Features:**
- ✅ Simple bash-based updates
- ✅ Automatic timestamp updates
- ✅ Build information synchronization
- ✅ Clean error handling

**Best for:** Quick manual updates, simple automation

### **2. Node.js Script (`update-wiki.js`)**

**Usage:**
```bash
node scripts/update-wiki.js
# or  
npm run update-wiki
```

**Features:**
- ✅ Advanced content generation
- ✅ Dynamic status information
- ✅ Automatic release notes
- ✅ Build validation
- ✅ Dependency analysis

**Best for:** Complex automation, rich content generation

### **3. GitHub Actions (`.github/workflows/update-wiki.yml`)**

**Features:**
- ✅ **Fully automated** - No manual intervention
- ✅ **Multi-trigger** - Responds to various events
- ✅ **PR integration** - Comments on merged PRs
- ✅ **Error handling** - Continues on build failures
- ✅ **Scheduled updates** - Regular maintenance

**Triggers:**
```yaml
# On code changes
push:
  branches: [ main ]
  paths: [ 'wiki-pages/**', 'package.json' ]

# After successful builds  
workflow_run:
  workflows: ["Build and Deploy"]
  types: [completed]

# Manual execution
workflow_dispatch:
  inputs:
    force_update:
      default: false
      type: boolean

# Daily maintenance
schedule:
  - cron: '0 6 * * *'
```

---

## 🌐 **Wiki Repository Structure**

Your GitHub wiki is actually a separate Git repository:

```
Main Repo:    https://github.com/username/dashboard-v2
Wiki Repo:    https://github.com/username/dashboard-v2.wiki.git
```

### **Wiki Pages Mapping:**
```
wiki-pages/Home.md → Home.md (wiki)
wiki-pages/Current-Status.md → Current-Status.md (wiki)  
wiki-pages/Feature-Status.md → Feature-Status.md (wiki)
wiki-pages/Known-Issues.md → Known-Issues.md (wiki)
wiki-pages/Architecture-Overview.md → Architecture-Overview.md (wiki)
```

---

## ⚙️ **Configuration**

### **Required Setup:**

1. **Enable GitHub Wiki** for your repository
2. **Create initial wiki pages** manually or via first script run
3. **Set up GitHub Actions** (optional but recommended)

### **Environment Variables:**

```bash
# For GitHub Actions (automatically available)
GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
GITHUB_REPOSITORY=${{ github.repository }}

# For local scripts (set these manually)
export WIKI_REPO_URL="https://github.com/username/repo.wiki.git"
```

### **Permissions:**

The GitHub Actions workflow needs:
- ✅ **Contents: read** - Access main repository
- ✅ **Actions: write** - Update workflow status  
- ✅ **Pages: write** - Update wiki pages (via GITHUB_TOKEN)

---

## 🚀 **Usage Examples**

### **Manual Update:**
```bash
# Quick update with current status
npm run update-wiki-simple

# Full update with dynamic content
npm run update-wiki

# Force update via GitHub Actions
gh workflow run update-wiki.yml -f force_update=true
```

### **Automated Update:**
```bash
# Trigger on main branch push
git push origin main

# Trigger after deployment
# (automatically happens after successful builds)

# View automation logs
gh run list --workflow=update-wiki.yml
```

### **Custom Integration:**
```javascript
// Use the Node.js module programmatically
const { generateStatusInfo, updateDynamicContent } = require('./scripts/update-wiki.js');

const status = generateStatusInfo();
console.log('Current build:', status.latestCommit);
console.log('Build status:', status.buildStatus);
```

---

## 📊 **Dynamic Content Features**

### **Automatically Updated Information:**

| Content | Source | Update Frequency |
|---------|--------|------------------|
| **Build Status** | `npm run build` | Every update |
| **Latest Commit** | `git rev-parse HEAD` | Every update |
| **Version** | `package.json` | Every update |
| **Dependencies** | `package.json` | Every update |
| **Recent Commits** | `git log` | Every update |
| **Timestamps** | Current date | Every update |

### **Generated Pages:**

- **Release Notes** - Automatic changelog generation
- **Performance Metrics** - Build and bundle analysis  
- **Current Status** - Real-time system health
- **All Pages** - Synchronized timestamps and build info

---

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **Permission Denied**
```bash
# Make scripts executable
chmod +x scripts/update-wiki.sh

# Check GitHub token permissions
gh auth status
```

#### **Wiki Repository Not Found**
```bash
# Initialize wiki manually first
# Go to GitHub → Your Repo → Wiki → Create First Page

# Then clone and verify
git clone https://github.com/username/repo.wiki.git
```

#### **Build Failures**
```bash
# Check build status
npm run build

# Fix TypeScript errors
npm run lint

# Verify all dependencies
npm ci
```

#### **GitHub Actions Failures**
```bash
# View workflow logs
gh run list --workflow=update-wiki.yml
gh run view [RUN_ID] --log

# Re-run failed jobs
gh run rerun [RUN_ID]
```

---

## 🎯 **Best Practices**

### **Recommended Workflow:**

1. **Development**:
   - Edit wiki pages in `wiki-pages/` directory
   - Test changes locally with `npm run update-wiki`
   - Commit changes to main repository

2. **Staging**:
   - GitHub Actions automatically updates wiki on push
   - Review updated wiki pages
   - Monitor workflow status

3. **Production**:
   - Wiki stays synchronized with deployments
   - Automatic release notes generation
   - Scheduled maintenance updates

### **Content Guidelines:**

- ✅ **Keep source files in main repo** - Single source of truth
- ✅ **Use dynamic placeholders** - Auto-updated content
- ✅ **Test locally first** - Verify before automation
- ✅ **Monitor automation** - Check GitHub Actions logs
- ✅ **Regular maintenance** - Review generated content

---

## 🔗 **Related Links**

- **GitHub Wiki Docs**: [docs.github.com/wiki](https://docs.github.com/en/communities/documenting-your-project-with-wikis)
- **GitHub Actions**: [docs.github.com/actions](https://docs.github.com/en/actions)
- **Wiki Repository**: [github.com/username/repo/wiki](https://github.com/MorpheusAIs/dashboard-v2/wiki)

---

*Last Updated: January 2025 | This documentation is automatically maintained* 