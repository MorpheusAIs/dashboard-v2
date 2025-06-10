#!/bin/bash

# Script to programmatically update GitHub wiki pages
# Usage: ./update-wiki.sh

set -e

REPO_URL="https://github.com/MorpheusAIs/dashboard-v2.wiki.git"
WIKI_DIR="temp-wiki"
MAIN_REPO_DIR="$(pwd)"

echo "🚀 Starting GitHub Wiki Update Process..."

# Clean up any existing wiki directory
if [ -d "$WIKI_DIR" ]; then
    rm -rf "$WIKI_DIR"
fi

# Clone the wiki repository
echo "📥 Cloning wiki repository..."
git clone "$REPO_URL" "$WIKI_DIR"
cd "$WIKI_DIR"

# Copy updated wiki pages from main repo
echo "📋 Copying updated wiki pages..."
cp "$MAIN_REPO_DIR/wiki-pages/Home.md" "./Home.md"
cp "$MAIN_REPO_DIR/wiki-pages/Current-Status.md" "./Current-Status.md"
cp "$MAIN_REPO_DIR/wiki-pages/Feature-Status.md" "./Feature-Status.md"
cp "$MAIN_REPO_DIR/wiki-pages/Known-Issues.md" "./Known-Issues.md"
cp "$MAIN_REPO_DIR/wiki-pages/Architecture-Overview.md" "./Architecture-Overview.md"

# Generate automated status updates
echo "🔄 Generating automated status updates..."

# Update build info in Current-Status.md
LATEST_COMMIT=$(cd "$MAIN_REPO_DIR" && git rev-parse --short HEAD)
BUILD_DATE=$(date +"%B %Y")
BUILD_STATUS="✅ Passing"

# Update the build information
sed -i.bak "s/Latest Build\*\*: \`[^`]*\`/Latest Build**: \`$LATEST_COMMIT\`/" Current-Status.md
sed -i.bak "s/Last Updated: .*/Last Updated: $BUILD_DATE/" Current-Status.md

# Update timestamps on all pages
for file in *.md; do
    if [ -f "$file" ]; then
        sed -i.bak "s/\*Last Updated: .*\*/\*Last Updated: $BUILD_DATE\*/" "$file"
    fi
done

# Clean up backup files
rm -f *.bak

# Commit and push changes
echo "📤 Committing and pushing wiki updates..."
git add .
git commit -m "Auto-update: Wiki pages synchronized with main repo ($LATEST_COMMIT)" || {
    echo "⚠️  No changes to commit"
    cd "$MAIN_REPO_DIR"
    rm -rf "$WIKI_DIR"
    exit 0
}

git push origin master

# Clean up
cd "$MAIN_REPO_DIR"
rm -rf "$WIKI_DIR"

echo "✅ Wiki update completed successfully!"
echo "🔗 View updated wiki at: https://github.com/MorpheusAIs/dashboard-v2/wiki" 