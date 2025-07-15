#!/bin/bash

# DynamoDB Debug Tool Installation Script
# This script sets up the DynamoDB JobExecutions Debug Tool

set -e

echo "🔧 Setting up DynamoDB Debug Tool..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v14 or higher) first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2)
REQUIRED_VERSION="14.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to v14 or higher."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check AWS CLI (optional but recommended)
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI detected"
    
    # Check if AWS credentials are configured
    if aws sts get-caller-identity &> /dev/null; then
        echo "✅ AWS credentials are configured"
    else
        echo "⚠️  AWS credentials not configured. Run 'aws configure' to set them up."
    fi
else
    echo "⚠️  AWS CLI not found. Install it for easier credential management:"
    echo "   Visit: https://aws.amazon.com/cli/"
fi

# Create desktop shortcut (optional)
read -p "📱 Create desktop shortcut? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DESKTOP_FILE="$HOME/Desktop/DynamoDB-Debug-Tool.desktop"
    CURRENT_DIR=$(pwd)
    
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DynamoDB Debug Tool
Comment=Debug DynamoDB JobExecutions
Exec=bash -c "cd '$CURRENT_DIR' && npm start"
Icon=$CURRENT_DIR/assets/icon.png
Terminal=false
Categories=Development;
EOF
    
    chmod +x "$DESKTOP_FILE"
    echo "✅ Desktop shortcut created"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "To run the tool:"
echo "  cd $(basename $(pwd))"
echo "  npm start"
echo ""
echo "To build for distribution:"
echo "  npm run build"
echo ""
echo "For help and documentation, see README.md" 