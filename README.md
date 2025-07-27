# DynamoDB Debug Tool

A comprehensive debugging tool for querying DynamoDB JobExecutions and JitEvents tables. Available as both an Electron desktop application and a web application, this tool provides advanced querying capabilities, error debugging features, and specialized analysis for stuck PR executions.

## Features

### Core Query Features
- 🔍 **Query JobExecutions Table**: Advanced querying with GSI1 index support
- 🎯 **Smart Filtering**: Filter by tenant ID, status, date range, and custom fields
- 📊 **Enhanced Results Display**: Sortable table with expandable cells and full record views
- 📤 **Export Capabilities**: Export results to JSON or CSV format
- 🔄 **Real-time AWS Status**: Monitor connection status and credential validation
- 💾 **Persistent Filters**: Automatically saves your last used filters

### Error Debugging & Analysis
- 🚨 **Stuck PR Detection**: Intelligent analysis of stuck pull request executions
- 📈 **Time-based Urgency System**: Color-coded prioritization (Critical/Warning/Recent)
- 🎯 **Smart Deduplication**: Finds latest event per unique PR for accurate stuck detection
- 📊 **Comprehensive Statistics**: Detailed breakdowns by urgency, repository, owner, and more
- 🔗 **Direct PR Links**: Quick access to GitHub pull requests from results

### Enhanced Data Visibility
- 🔧 **Control Name Display**: Shows which security control triggered executions
- ❌ **Error Expansion**: Detailed error viewing for failed executions
- 📋 **Additional Fields**: Expandable view of all execution metadata
- 🔍 **Full Record JSON**: Complete data inspection with modal dialogs
- 📱 **Cell Expansion**: Long text fields can be expanded for better readability

### Deployment Options
- 🖥️ **Desktop Application**: Full-featured Electron app with AWS profile switching
- 🌐 **Web Application**: Browser-based interface with simplified AWS authentication
- ⚡ **Simplified Setup**: Environment-based credentials for production use

## Prerequisites

- Node.js (v14 or higher)
- AWS credentials configured (via AWS CLI, environment variables, or IAM roles)
- Access to DynamoDB JobExecutions and JitEvents tables
- For production use: `aws-vault` for secure credential management

## Installation

1. Clone or download the tool:
```bash
git clone <repository-url>
cd dynamodb-debug-tool
```

2. Install dependencies:
```bash
npm install
```

3. Configure AWS credentials (choose one method):
   - **AWS CLI**: `aws configure`
   - **Environment variables**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - **IAM roles** (if running on EC2)
   - **aws-vault** (recommended for production): `aws-vault add <profile>`

## Usage

### Running the Application

#### Desktop Application (Electron)
```bash
npm start
```
- Full-featured interface with AWS profile switching
- Built-in credential management
- Desktop notifications and system integration

#### Web Application
```bash
# With aws-vault (recommended)
aws-vault exec <profile> -- npm run webapp

# Or with environment variables
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
npm run webapp
```
- Access at `http://localhost:3000`
- Simplified authentication using environment credentials
- All features available in browser interface

### Query Tool

#### Basic Querying
1. **Enter Tenant ID**: Provide the UUID of the tenant you want to query
2. **Select Status**: Choose from started, success, failure, or timeout
3. **Set Date Range** (optional): Filter results by creation date
4. **Set Limit**: Number of results to return (default: 50, max: 1000)
5. **Click "Query Executions"** to run the query

#### Advanced Filtering
- **Custom Filters**: Add filters for any field (jit_event_name, control_name, etc.)
- **Operators**: Supports equals, contains, greater than, less than
- **Multiple Filters**: Combine multiple conditions with AND logic

#### Query Pattern
The tool queries DynamoDB using the following pattern:
```
GSI1PK = TENANT#<tenant_id>#STATUS#<status>
GSI1SK >= <start_date> (optional)
GSI1SK <= <end_date> (optional)
FilterExpression: contains(field, value) (for custom filters)
```

### Error Debugging

#### Stuck PR Analysis
1. **Switch to "Error Debugging" tab** (web version) or use built-in features (desktop)
2. **Enter Tenant ID** for debugging
3. **Click "Find Stuck PR Executions"**
4. **Review Results**:
   - **Statistics Dashboard**: Urgency breakdown, repository counts, time ranges
   - **Detailed Table**: PR numbers, titles, branches, elapsed time, urgency levels
   - **Direct Links**: Click through to GitHub PRs

#### Urgency System
- 🟢 **Recent** (< 3 minutes): Newly stuck PRs
- 🟠 **Warning** (3-10 minutes): Moderately delayed
- 🔴 **Critical** (> 10 minutes): Requires immediate attention

#### Smart Detection Algorithm
1. Fetches all PR-related JIT events from past 2 days
2. Groups by unique PR (owner + repo + branch + PR number)
3. Finds latest event per PR
4. Identifies truly stuck PRs (latest status: started/creating/job_sent)
5. Calculates time elapsed and assigns urgency levels

### Enhanced Data Display

#### Table Features
- **Sortable Columns**: Click headers to sort by any field
- **Expandable Cells**: Long text shows with expand/collapse buttons
- **Error Details**: Failed executions show expandable error information
- **Additional Fields**: Non-core fields displayed in expandable sections
- **Full Record View**: Complete JSON inspection in modal dialogs

#### Available Columns
- **JIT Event ID**: Event that triggered the execution
- **Event Name**: Type of JIT event (pull_request_updated, etc.)
- **Execution ID**: Unique execution identifier
- **Status**: Current execution status
- **Control Name**: Security control that was executed
- **Created At**: Execution start time
- **Completed At**: Execution completion time (if applicable)
- **Errors**: Error details for failed executions
- **Additional Data**: All other metadata fields

#### Actions
- **View All**: Complete record inspection in large modal
- **Copy ID**: Copy execution ID to clipboard  
- **Expand Row**: Show complete JSON for the execution
- **Export**: Save results to JSON or CSV
- **Copy kubectl logs**: Copy kubectl logs command for troubleshooting
- **Download Output**: Download execution output file from S3 storage

## Building for Distribution

### Electron Desktop App
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build-mac    # macOS
npm run build-win    # Windows
npm run build-linux  # Linux
```

Built applications will be in the `dist/` directory.

### Web Application Deployment
The web application can be deployed to any Node.js hosting service:
```bash
# Set environment variables on your hosting platform
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# Start the server
npm run webapp
```

## Configuration

### AWS Configuration
- **Region**: us-east-1 (default)
- **Tables**: JobExecutions, JitEvents
- **Indexes**: GSI1 (both tables)
- **S3 Buckets**: jit-execution-outputs-prod (execution output files)

### Environment Variables
```bash
AWS_REGION=us-east-1              # AWS region
AWS_ACCESS_KEY_ID=your-key        # AWS access key
AWS_SECRET_ACCESS_KEY=your-secret # AWS secret key
PORT=3000                         # Web app port (optional)
```

### Tables and Indexes
The tool queries two main DynamoDB tables:

#### JobExecutions Table
- **Primary Key**: execution_id
- **GSI1**: GSI1PK (TENANT#<id>#STATUS#<status>) / GSI1SK (timestamp)
- **Use Case**: General execution querying and filtering

#### JitEvents Table  
- **Primary Key**: jit_event_id
- **GSI1**: GSI1PK_TENANT_ID (TENANT#<id>) / GSI1SK_CREATED_AT (CREATED_AT#timestamp)
- **Use Case**: Stuck PR analysis and event timeline investigation

## Troubleshooting

### Common Issues

1. **"No AWS credentials found"**
   - **Desktop**: Select an AWS profile from the dropdown
   - **Web**: Ensure environment variables are set or use `aws-vault exec`
   - Verify: `aws sts get-caller-identity`

2. **"Query failed: ResourceNotFoundException"**
   - Verify table names and indexes exist
   - Check IAM permissions for DynamoDB access
   - Ensure correct AWS region configuration

3. **"Stuck PR query returns no results"**
   - Verify tenant ID is correct
   - Check if there are actually stuck PRs in the past 2 days
   - Review console logs for query details

4. **"Web app shows 0 results but desktop app works"**
   - Ensure DynamoDB client is recreated after credential updates
   - Check that environment credentials are properly set
   - Verify region configuration matches between environments

### Debug Mode

#### Desktop Application
1. Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open DevTools
2. Check the Console tab for detailed error messages
3. Network tab shows AWS API calls

#### Web Application
1. Open browser DevTools (F12)
2. Check Console for client-side errors
3. Check Network tab for API call failures
4. Server logs show detailed query debugging

### Performance Optimization

#### Large Result Sets
- Use date range filters to limit scope
- Increase query limits for fewer round trips
- The tool automatically handles pagination for complete results

#### Stuck PR Analysis
- Queries are optimized with proper indexing
- Pagination ensures all events are analyzed
- Deduplication happens in memory for accuracy

## Security Considerations

- **Credential Handling**: AWS SDK manages credentials securely
- **Read-Only Operations**: Tool only performs query operations
- **IAM Compliance**: Respects all AWS IAM permissions
- **Local Processing**: No data transmitted to external servers
- **Environment Isolation**: Web app validates credentials on startup

## Development

### Project Structure
```
dynamodb-debug-tool/
├── main.js              # Electron main process
├── server.js            # Express web server
├── renderer.js          # Electron frontend logic
├── webapp.html          # Web application interface
├── index.html           # Desktop application interface
├── styles.css           # Shared styling
├── public/              # Web app static assets
├── .cursor/             # Development notes and research
├── package.json         # Dependencies and scripts
├── install.sh           # Automated setup script
└── README.md           # This documentation
```

### Adding Features

#### New Query Capabilities
1. **Frontend**: Modify form in `index.html` or `webapp.html`
2. **Backend**: Update query logic in `main.js` or `server.js`
3. **Filters**: Add new operators in filter expression builders

#### Additional Analysis Tools
1. **New Endpoints**: Add API routes in `server.js`
2. **UI Components**: Implement in HTML with matching CSS
3. **Data Processing**: Add analysis logic with proper error handling

#### Enhanced Visualizations
1. **Statistics**: Extend stats calculation in analysis functions
2. **Charts**: Add chart libraries and implement visualizations
3. **Export Formats**: Add new export types in export handlers

### API Endpoints (Web Application)

- `GET /` - Main application interface
- `POST /api/query` - JobExecutions table queries
- `POST /api/stuck-pr-executions` - Stuck PR analysis
- `GET /api/status` - AWS connection validation

### Testing

#### Mock Data Testing
Replace DynamoDB queries with mock data for development:

```javascript
// In main.js or server.js
const mockResult = {
  success: true,
  data: [
    {
      jit_event_id: "test-event-123",
      execution_id: "test-exec-456", 
      status: "started",
      control_name: "test-control",
      created_at: new Date().toISOString(),
      jit_event_name: "pull_request_updated"
    }
  ],
  count: 1,
  scannedCount: 1
};
```

#### Production Testing
```bash
# Test desktop application
npm start

# Test web application with real credentials
aws-vault exec jit-prod -- npm run webapp

# Test build process
npm run build
```

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Open DevTools/Console for detailed error messages
3. Review `.cursor/` directory for development notes and research
4. Contact the development team with specific error details and reproduction steps

---

**Quick Start Commands:**
```bash
# Desktop app
npm install && npm start

# Web app with aws-vault
npm install && aws-vault exec <profile> -- npm run webapp

# Build for distribution
npm run build
``` 
