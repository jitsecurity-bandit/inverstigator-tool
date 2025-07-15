# DynamoDB JobExecutions Debug Tool

A modern Electron-based application for debugging and querying DynamoDB JobExecutions table data. This tool provides an intuitive interface for querying job execution data with filters, sorting, and export capabilities.

## Features

- 🔍 **Query JobExecutions Table**: Query the DynamoDB JobExecutions table using GSI1 index
- 🎯 **Advanced Filtering**: Filter by tenant ID, status, and date range
- 📊 **Sortable Results**: Click column headers to sort results
- 📤 **Export Data**: Export results to JSON or CSV format
- 🔄 **Real-time AWS Status**: Monitor AWS connection status
- 💾 **Save Filters**: Automatically saves your last used filters
- 🎨 **Modern UI**: Clean, responsive interface with dark theme support

## Prerequisites

- Node.js (v14 or higher)
- AWS credentials configured (via AWS CLI, environment variables, or IAM roles)
- Access to the DynamoDB JobExecutions table

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

3. Configure AWS credentials (one of the following methods):
   - AWS CLI: `aws configure`
   - Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - IAM roles (if running on EC2)
   - AWS credentials file

## Usage

### Running the Application

```bash
npm start
```

### Querying Data

1. **Enter Tenant ID**: Provide the UUID of the tenant you want to query
2. **Select Status**: Choose from started, success, failure, or timeout
3. **Set Date Range** (optional): Filter results by creation date
4. **Set Limit**: Number of results to return (default: 50, max: 1000)
5. **Click "Query Executions"** to run the query

### Query Pattern

The tool queries the DynamoDB table using the following pattern:
```
GSI1PK = TENANT#<tenant_id>#STATUS#<status>
GSI1SK >= <start_date> (optional)
GSI1SK <= <end_date> (optional)
```

### Viewing Results

- **Sort**: Click column headers to sort results
- **View Details**: Click "View" to see the full JSON data for an execution
- **Copy ID**: Click "Copy ID" to copy the execution ID to clipboard
- **Export**: Use "Export JSON" or "Export CSV" buttons to save results

### Displayed Fields

- **JIT Event ID**: The event that triggered the execution
- **Execution ID**: Unique identifier for the execution
- **Status**: Current status (started, success, failure, timeout)
- **Created At**: When the execution was created
- **Completed At**: When the execution completed (if applicable)
- **Errors**: Whether errors occurred during execution

## Building for Distribution

### Build for Current Platform
```bash
npm run build
```

### Build for Specific Platforms
```bash
npm run build-mac    # macOS
npm run build-win    # Windows
npm run build-linux  # Linux
```

Built applications will be in the `dist/` directory.

## Configuration

### AWS Configuration

The tool uses the AWS SDK with the following default settings:
- **Region**: us-east-1
- **Table Name**: JobExecutions
- **Index Name**: GSI1

### Environment Variables

You can override default settings using environment variables:
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

## Troubleshooting

### Common Issues

1. **"No AWS credentials found"**
   - Ensure AWS credentials are configured
   - Check AWS CLI configuration: `aws configure list`
   - Verify environment variables are set

2. **"Query failed: ResourceNotFoundException"**
   - Verify the table name and index exist
   - Check if you have permission to access the table

3. **"Connection check failed"**
   - Check internet connectivity
   - Verify AWS region is correct
   - Ensure firewall isn't blocking AWS API calls

### Debug Mode

To enable debug mode and see detailed logs:
1. Open the application
2. Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open DevTools
3. Check the Console tab for detailed error messages

## Security Considerations

- AWS credentials are handled by the AWS SDK and are not stored by the application
- All queries are read-only operations
- The tool respects AWS IAM permissions
- No data is transmitted to external servers

## Development

### Project Structure
```
dynamodb-debug-tool/
├── main.js          # Electron main process
├── renderer.js      # Frontend JavaScript
├── index.html       # Main UI
├── styles.css       # Styling
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

### Adding Features

1. **New Query Filters**: Modify the form in `index.html` and update query logic in `main.js`
2. **Additional Export Formats**: Extend the export functionality in `main.js`
3. **UI Improvements**: Update `styles.css` and `index.html`

### Testing

The tool can be tested with mock data by modifying the query handler in `main.js`:

```javascript
// For testing - replace actual DynamoDB query with mock data
const mockResult = {
  success: true,
  data: [
    {
      jit_event_id: "test-event-123",
      execution_id: "test-exec-456",
      status: "success",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      errors: null
    }
  ],
  count: 1,
  scannedCount: 1
};
```

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Open DevTools to check for error messages
3. Contact the development team with specific error details 