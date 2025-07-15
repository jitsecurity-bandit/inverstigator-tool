# AWS Amplify Deployment Guide

## Quick Setup

### 1. Build Configuration
- **Build command**: `npm run webapp` (or use default `npm start`)
- **Start command**: `npm start`
- **Node version**: Latest LTS (18.x or 20.x)

### 2. Environment Variables (Required)
Set these in Amplify Console → App Settings → Environment Variables:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### 3. Amplify Build Settings
The `amplify.yml` file is already configured. If you need to customize:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - echo "No build needed - Express.js app will run as-is"
  artifacts:
    baseDirectory: .
    files:
      - '**/*'
    name: dynamodb-debug-tool
  cache:
    paths:
      - node_modules/**/*
```

### 4. IAM Permissions
Your AWS credentials need DynamoDB permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DescribeTable",
        "dynamodb:ListTables"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

## Deployment Steps

1. **Connect Repository**: Link your GitHub/GitLab repo to Amplify
2. **Configure Build**: Use the provided `amplify.yml` or set manually:
   - Build command: `npm run webapp`
   - Start command: `npm start`  
3. **Set Environment Variables**: Add AWS credentials in Amplify Console
4. **Deploy**: Amplify will handle the rest

## Testing Locally
```bash
# Set environment variables
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret

# Run the app
npm run webapp
```

## Notes
- The app requires AWS credentials to access DynamoDB
- Port will be automatically assigned by Amplify (ignore local PORT=3000)
- The app validates AWS credentials on startup and will exit if invalid 