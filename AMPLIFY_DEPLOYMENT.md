# AWS Amplify Deployment Guide

## Important: Node.js Hosting Required

This is an **Express.js server application** - you need to use **Amplify Hosting with Node.js runtime**, not static hosting.

## Amplify Setup Steps

### 1. Create New Amplify App
- Go to AWS Amplify Console
- Choose "Host web app"
- Connect your Git repository
- **IMPORTANT**: Select "Web app" (not "Static web app")

### 2. Build Configuration
When Amplify asks for build settings:

- **Build command**: Leave empty or use `echo "No build needed"`
- **Output directory**: `.` (current directory)
- **Start command**: `npm start`
- **Node.js version**: 18.x or 20.x

### 3. Environment Variables (Critical!)
In Amplify Console → App Settings → Environment Variables, add:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### 4. Advanced Settings
- **Runtime**: Node.js
- **Runtime version**: 18.x (or latest LTS)
- **Platform**: Web

## Alternative: Use Elastic Beanstalk or App Runner

If Amplify Node.js hosting doesn't work, consider:

1. **AWS App Runner**: Better for containerized Node.js apps
2. **Elastic Beanstalk**: Traditional Node.js hosting
3. **ECS/Fargate**: For Docker deployment

## Local Testing
```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
npm start
```

## Troubleshooting

- **"No index.html found"**: This means Amplify is treating it as static hosting. Make sure you selected "Web app" not "Static web app"
- **"Build failed"**: Check that Node.js runtime is selected
- **"App crashes on startup"**: Verify AWS environment variables are set

## Files Added for Amplify
- ✅ `amplify.yml` - Build configuration
- ✅ `index.html` - Fallback page (shouldn't be needed for Node.js hosting)
- ✅ Updated `package.json` with proper start script 