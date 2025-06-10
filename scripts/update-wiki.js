#!/usr/bin/env node

/**
 * Advanced GitHub Wiki Update Script
 * Generates dynamic content and updates wiki pages programmatically
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WIKI_REPO_URL = 'https://github.com/MorpheusAIs/dashboard-v2.wiki.git';
const WIKI_DIR = 'temp-wiki';
const MAIN_REPO_DIR = process.cwd();

// Configuration
const config = {
  repoUrl: WIKI_REPO_URL,
  wikiDir: WIKI_DIR,
  mainRepoDir: MAIN_REPO_DIR,
  pages: {
    'Home.md': 'wiki-pages/Home.md',
    'Current-Status.md': 'wiki-pages/Current-Status.md',
    'Feature-Status.md': 'wiki-pages/Feature-Status.md',
    'Known-Issues.md': 'wiki-pages/Known-Issues.md',
    'Architecture-Overview.md': 'wiki-pages/Architecture-Overview.md'
  }
};

/**
 * Execute shell command and return output
 */
function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      cwd: options.cwd || process.cwd(),
      stdio: 'pipe'
    }).trim();
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

/**
 * Get current build information
 */
function getBuildInfo() {
  const latestCommit = exec('git rev-parse --short HEAD');
  const buildDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });
  
  // Get build status by checking if build passes
  let buildStatus = '✅ Passing';
  try {
    exec('npm run build');
  } catch (error) {
    buildStatus = '❌ Failing';
  }

  return { latestCommit, buildDate, buildStatus };
}

/**
 * Generate dynamic status information
 */
function generateStatusInfo() {
  const buildInfo = getBuildInfo();
  
  // Get package.json info
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Get recent commits
  const recentCommits = exec('git log --oneline -5').split('\n');
  
  // Get current branch
  const currentBranch = exec('git branch --show-current');
  
  // Check for uncommitted changes
  const hasUncommittedChanges = exec('git status --porcelain').length > 0;
  
  return {
    ...buildInfo,
    version: packageJson.version,
    name: packageJson.name,
    recentCommits,
    currentBranch,
    hasUncommittedChanges,
    dependencies: Object.keys(packageJson.dependencies).length,
    devDependencies: Object.keys(packageJson.devDependencies).length
  };
}

/**
 * Update dynamic content in wiki pages
 */
function updateDynamicContent(filePath, statusInfo) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update timestamps
  content = content.replace(
    /\*Last Updated: .*\*/g, 
    `*Last Updated: ${statusInfo.buildDate}*`
  );
  
  // Update build information
  content = content.replace(
    /Latest Build\*\*: `[^`]*`/g,
    `Latest Build**: \`${statusInfo.latestCommit}\``
  );
  
  // Update build status
  content = content.replace(
    /Build Status\*\*: [^|]*/g,
    `Build Status**: ${statusInfo.buildStatus}`
  );
  
  // Update version information
  content = content.replace(
    /Version\*\*: [0-9.]+/g,
    `Version**: ${statusInfo.version}`
  );
  
  // Update dependency count
  content = content.replace(
    /Dependencies: \d+/g,
    `Dependencies: ${statusInfo.dependencies}`
  );
  
  fs.writeFileSync(filePath, content);
}

/**
 * Generate automated release notes
 */
function generateReleaseNotes(statusInfo) {
  const releaseNotes = `# Release Notes

*Last Updated: ${statusInfo.buildDate}*

## Latest Release

**Version**: ${statusInfo.version}  
**Build**: \`${statusInfo.latestCommit}\`  
**Branch**: ${statusInfo.currentBranch}  
**Status**: ${statusInfo.buildStatus}

## Recent Changes

${statusInfo.recentCommits.map(commit => `- ${commit}`).join('\n')}

## Technical Details

- **Dependencies**: ${statusInfo.dependencies} production, ${statusInfo.devDependencies} development
- **Uncommitted Changes**: ${statusInfo.hasUncommittedChanges ? 'Yes' : 'No'}
- **Build Date**: ${statusInfo.buildDate}

## Next Steps

${statusInfo.hasUncommittedChanges ? 
  '⚠️ There are uncommitted changes that should be reviewed.' : 
  '✅ Repository is clean and up to date.'
}

---

[← Back to Wiki Home](Home)`;

  return releaseNotes;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Advanced GitHub Wiki Update Process...');
  
  try {
    // Get current status information
    console.log('📊 Gathering project information...');
    const statusInfo = generateStatusInfo();
    
    // Clean up any existing wiki directory
    if (fs.existsSync(config.wikiDir)) {
      exec(`rm -rf ${config.wikiDir}`);
    }
    
    // Clone the wiki repository
    console.log('📥 Cloning wiki repository...');
    exec(`git clone ${config.repoUrl} ${config.wikiDir}`);
    
    // Copy and update wiki pages
    console.log('📋 Updating wiki pages...');
    for (const [wikiFile, sourceFile] of Object.entries(config.pages)) {
      const sourcePath = path.join(config.mainRepoDir, sourceFile);
      const targetPath = path.join(config.wikiDir, wikiFile);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        updateDynamicContent(targetPath, statusInfo);
        console.log(`✅ Updated ${wikiFile}`);
      } else {
        console.warn(`⚠️  Source file not found: ${sourcePath}`);
      }
    }
    
    // Generate release notes
    console.log('📝 Generating release notes...');
    const releaseNotes = generateReleaseNotes(statusInfo);
    fs.writeFileSync(path.join(config.wikiDir, 'Release-Notes.md'), releaseNotes);
    
    // Commit and push changes
    console.log('📤 Committing and pushing wiki updates...');
    process.chdir(config.wikiDir);
    
    exec('git add .');
    
    try {
      exec(`git commit -m "Auto-update: Wiki synchronized with main repo (${statusInfo.latestCommit})"`);
      exec('git push origin master');
      console.log('✅ Wiki update completed successfully!');
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        console.log('⚠️  No changes to commit - wiki is already up to date');
      } else {
        throw error;
      }
    }
    
    // Clean up
    process.chdir(config.mainRepoDir);
    exec(`rm -rf ${config.wikiDir}`);
    
    console.log('🔗 View updated wiki at: https://github.com/MorpheusAIs/dashboard-v2/wiki');
    
  } catch (error) {
    console.error('❌ Wiki update failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, generateStatusInfo, updateDynamicContent }; 