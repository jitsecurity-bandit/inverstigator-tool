const express = require('express');
const path = require('path');
const AWS = require('aws-sdk');

const app = express();
const port = process.env.PORT || 3000;

// Configure AWS - will automatically use environment credentials
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'webapp.html'));
});

// Function to validate AWS credentials
async function validateAwsCredentials() {
  try {
    console.log('=== AWS CREDENTIAL VALIDATION ===');
    
    // Test STS GetCallerIdentity
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity().promise();
    console.log('STS Identity:', {
      Account: identity.Account,
      Arn: identity.Arn,
      UserId: identity.UserId
    });
    
    // Test DynamoDB ListTables
    const dynamodbClient = new AWS.DynamoDB();
    const tables = await dynamodbClient.listTables({ Limit: 10 }).promise();
    console.log('Available DynamoDB Tables:', tables.TableNames);
    
    // Test if JitEvents table exists
    const hasJitEvents = tables.TableNames.includes('JitEvents');
    console.log('JitEvents table exists:', hasJitEvents);
    
    if (hasJitEvents) {
      // Describe the table
      const tableDesc = await dynamodbClient.describeTable({ TableName: 'JitEvents' }).promise();
      console.log('JitEvents table status:', tableDesc.Table.TableStatus);
      console.log('JitEvents GSIs:', tableDesc.Table.GlobalSecondaryIndexes?.map(gsi => gsi.IndexName));
    }
    
    return { valid: true, identity, tables: tables.TableNames, hasJitEvents };
  } catch (error) {
    console.error('AWS credential validation failed:', error);
    return { valid: false, error: error.message };
  }
}

// Initialize and validate AWS on startup
async function initializeApp() {
  console.log('Initializing app with environment AWS credentials...');
  
  // Check for required environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('ERROR: AWS credentials not found in environment variables');
    console.error('Please run: aws-vault exec <profile> -- npm run webapp');
    process.exit(1);
  }
  
  console.log('AWS credentials found in environment');
  console.log('Region:', AWS.config.region);
  
  // Validate credentials
  const validation = await validateAwsCredentials();
  if (!validation.valid) {
    console.error('ERROR: AWS credential validation failed:', validation.error);
    process.exit(1);
  }
  
  console.log('AWS credentials validated successfully');
}

// API Routes

// Get AWS configuration
app.get('/api/aws-config', async (req, res) => {
  try {
    // Check if AWS credentials are available
    const hasCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

    res.json({
      region: AWS.config.region,
      hasCredentials,
      sdkVersion: AWS.VERSION
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Debug endpoint for AWS validation
app.get('/api/debug-aws', async (req, res) => {
  try {
    const validation = await validateAwsCredentials();
    res.json({
      region: AWS.config.region,
      validation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const { tenantId, status, startDate, endDate, limit = 50, customFilters = [] } = req.body;
    
    console.log(`=== DYNAMODB QUERY DEBUG ===`);
    console.log(`Region: ${AWS.config.region}`);
    
    // Collect all items with pagination
    let allItems = [];
    let lastEvaluatedKey = null;
    let totalScanned = 0;
    let queryCount = 0;
    
    do {
      queryCount++;
      console.log(`Query ${queryCount}: Starting pagination query...`);
      console.log(`LastEvaluatedKey from previous query:`, lastEvaluatedKey ? 'exists' : 'null');
      
      const queryParams = {
        TableName: 'JobExecutions',
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}#STATUS#${status}`
        },
        Limit: Math.max(limit, 1000), // Use at least 1000 for efficient pagination
        ScanIndexForward: false
      };

      // Add date filter if provided
      if (startDate) {
        queryParams.KeyConditionExpression += ' AND GSI1SK >= :startDate';
        queryParams.ExpressionAttributeValues[':startDate'] = startDate;
      }

      if (endDate) {
        if (startDate) {
          queryParams.KeyConditionExpression = queryParams.KeyConditionExpression.replace('>=', 'BETWEEN');
          queryParams.KeyConditionExpression += ' AND :endDate';
        } else {
          queryParams.KeyConditionExpression += ' AND GSI1SK <= :endDate';
        }
        queryParams.ExpressionAttributeValues[':endDate'] = endDate;
      }

      // Handle custom filters
      if (customFilters && customFilters.length > 0) {
        const filterExpressions = [];
        const expressionAttributeNames = queryParams.ExpressionAttributeNames || {};
        const expressionAttributeValues = queryParams.ExpressionAttributeValues || {};
        
        customFilters.forEach((filter, index) => {
          const { field, operator, value } = filter;
          
          // Handle nested fields (e.g., "context.jit_event.pull_request_number")
          let fieldExpression;
          if (field.includes('.')) {
            const fieldParts = field.split('.');
            const fieldPlaceholders = fieldParts.map((part, partIndex) => {
              const placeholder = `#customField${index}_${partIndex}`;
              expressionAttributeNames[placeholder] = part;
              return placeholder;
            });
            fieldExpression = fieldPlaceholders.join('.');
          } else {
            const fieldPlaceholder = `#customField${index}`;
            expressionAttributeNames[fieldPlaceholder] = field;
            fieldExpression = fieldPlaceholder;
          }
          
          const valuePlaceholder = `:customValue${index}`;
          
          switch (operator) {
            case '=':
              filterExpressions.push(`${fieldExpression} = ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case '<':
              filterExpressions.push(`${fieldExpression} < ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case '>':
              filterExpressions.push(`${fieldExpression} > ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case 'contains':
              filterExpressions.push(`contains(${fieldExpression}, ${valuePlaceholder})`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case 'begins_with':
              filterExpressions.push(`begins_with(${fieldExpression}, ${valuePlaceholder})`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            default:
              filterExpressions.push(`${fieldExpression} = ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
          }
        });
        
        if (filterExpressions.length > 0) {
          queryParams.FilterExpression = filterExpressions.join(' AND ');
          queryParams.ExpressionAttributeNames = expressionAttributeNames;
          queryParams.ExpressionAttributeValues = { ...queryParams.ExpressionAttributeValues, ...expressionAttributeValues };
        }
      }

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
        console.log(`Using ExclusiveStartKey:`, JSON.stringify(lastEvaluatedKey, null, 2));
      }

      console.log(`Query ${queryCount} params:`, JSON.stringify(queryParams, null, 2));
      
      const result = await dynamodb.query(queryParams).promise();
      
      console.log(`Query ${queryCount} result: Count=${result.Count}, ScannedCount=${result.ScannedCount}, Items=${result.Items.length}`);
      console.log(`LastEvaluatedKey returned:`, result.LastEvaluatedKey ? 'exists' : 'null');
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
        console.log(`Added ${result.Items.length} items. Total so far: ${allItems.length}`);
        console.log('First item from batch created_at:', result.Items[0]?.created_at);
        console.log('Last item from batch created_at:', result.Items[result.Items.length - 1]?.created_at);
      }
      
      totalScanned += result.ScannedCount;
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      console.log(`Query ${queryCount} complete. Will continue: ${!!lastEvaluatedKey}`);
      
    } while (lastEvaluatedKey);
    
    console.log(`Pagination complete. Total items collected: ${allItems.length}, Total scanned: ${totalScanned}, Queries executed: ${queryCount}`);
    
    // Return all collected results without applying limit
    const finalResults = allItems;
    console.log(`Final results: ${finalResults.length} items`);
    
    // If no results, try a simple scan to see if table has any data
    if (finalResults.length === 0) {
      console.log('=== DEBUGGING: Trying simple scan ===');
      try {
        const scanResult = await dynamodb.scan({
          TableName: 'JobExecutions',
          Limit: 1
        }).promise();
        console.log(`Scan result: Count=${scanResult.Count}, has any data: ${scanResult.Items.length > 0}`);
        if (scanResult.Items.length > 0) {
          console.log('First scan item:', JSON.stringify(scanResult.Items[0], null, 2));
        }
      } catch (scanError) {
        console.error('Scan error:', scanError);
      }
    }
    
    res.json({
      success: true,
      data: finalResults,
      count: finalResults.length,
      totalCollected: allItems.length,
      scannedCount: totalScanned,
      queriesExecuted: queryCount
    });
  } catch (error) {
    console.error('DynamoDB query error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// // Mountpoint download endpoint
// app.post('/api/mountpoint-download', async (req, res) => {
//   try {
//     const { tenantId, jitEventId } = req.body;
//
//     if (!tenantId || !jitEventId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Missing required parameters: tenantId and jitEventId'
//       });
//     }
//
//     console.log(`=== MOUNTPOINT DOWNLOAD REQUEST ===`);
//     console.log(`TenantId: ${tenantId}`);
//     console.log(`JitEventId: ${jitEventId}`);
//
//     // Initialize S3 client with fresh credentials
//     const s3 = new AWS.S3({
//       region: AWS.config.region,
//       signatureVersion: 'v4'
//     });
//
//     // Construct the bucket name and prefix based on tenantId and jitEventId
//     const bucketName = process.env.S3_BUCKET_NAME || 'jit-events-storage';
//     const prefix = `${tenantId}/${jitEventId}/mountpoint/`;
//
//     console.log(`Checking S3 bucket: ${bucketName}`);
//     console.log(`Path prefix: ${prefix}`);
//
//     try {
//       const listResult = await s3.listObjectsV2({
//         Bucket: bucketName,
//         Prefix: prefix,
//         MaxKeys: 5 // Just to check if directory exists
//       }).promise();
//
//       if (!listResult.Contents || listResult.Contents.length === 0) {
//         return res.status(404).json({
//           success: false,
//           error: 'No files found in the specified mountpoint directory'
//         });
//       }
//
//       console.log(`Found ${listResult.Contents.length} files in the mountpoint directory`);
//
//       // Create a signed URL that expires in 15 minutes (900 seconds)
//       const signedUrl = s3.getSignedUrl('getObject', {
//         Bucket: bucketName,
//         Key: listResult.Contents[0].Key, // Get the first file
//         Expires: 900
//       });
//
//       return res.json({
//         success: true,
//         signedUrl,
//         fileCount: listResult.Contents.length,
//         expiresIn: '15 minutes'
//       });
//
//     } catch (s3Error) {
//       console.error('Error listing objects in bucket:', s3Error);
//       return res.status(500).json({
//         success: false,
//         error: `S3 error: ${s3Error.message}`,
//         code: s3Error.code
//       });
//     }
//   } catch (error) {
//     console.error('Mountpoint download error:', error);
//     return res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// New endpoint for querying JitEvents table
app.post('/api/query-jit-events', async (req, res) => {
  try {
    const { tenantId, status, eventNameFilter, startDate, endDate, limit = 50, customFilters = [] } = req.body;
    
    console.log(`=== JITEVENTS QUERY DEBUG ===`);
    console.log(`Region: ${AWS.config.region}`);
    console.log(`TenantId: ${tenantId}`);
    console.log(`Status: ${status}`);
    console.log(`EventNameFilter: ${eventNameFilter}`);
    
    // Collect all items with pagination
    let allItems = [];
    let lastEvaluatedKey = null;
    let totalScanned = 0;
    let queryCount = 0;
    
    do {
      queryCount++;
      console.log(`Query ${queryCount}: Starting pagination query...`);
      console.log(`LastEvaluatedKey from previous query:`, lastEvaluatedKey ? 'exists' : 'null');
      
      const queryParams = {
        TableName: 'JitEvents',
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK_TENANT_ID_STATUS = :pk',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}#STATUS#${status}`
        },
        Limit: Math.max(limit, 1000), // Use at least 1000 for efficient pagination
        ScanIndexForward: false // Sort descending by GSI2SK
      };

      // Add date filter if provided
      if (startDate) {
        queryParams.KeyConditionExpression += ' AND GSI2SK >= :startDate';
        queryParams.ExpressionAttributeValues[':startDate'] = startDate;
      }

      if (endDate) {
        if (startDate) {
          queryParams.KeyConditionExpression = queryParams.KeyConditionExpression.replace('>=', 'BETWEEN');
          queryParams.KeyConditionExpression += ' AND :endDate';
        } else {
          queryParams.KeyConditionExpression += ' AND GSI2SK <= :endDate';
        }
        queryParams.ExpressionAttributeValues[':endDate'] = endDate;
      }

      // Initialize filter expressions array and attribute names/values
      const filterExpressions = [];
      const expressionAttributeNames = queryParams.ExpressionAttributeNames || {};
      const expressionAttributeValues = queryParams.ExpressionAttributeValues || {};

      // Add event name filter if provided
      if (eventNameFilter && eventNameFilter.trim()) {
        const eventNamePlaceholder = '#eventName';
        const eventValuePlaceholder = ':eventNameValue';
        
        expressionAttributeNames[eventNamePlaceholder] = 'jit_event_name';
        expressionAttributeValues[eventValuePlaceholder] = eventNameFilter.trim();
        filterExpressions.push(`contains(${eventNamePlaceholder}, ${eventValuePlaceholder})`);
      }

      // Handle custom filters
      if (customFilters && customFilters.length > 0) {
        customFilters.forEach((filter, index) => {
          const { field, operator, value } = filter;
          
          // Handle nested fields (e.g., "jit_event.pull_request_number")
          let fieldExpression;
          if (field.includes('.')) {
            const fieldParts = field.split('.');
            const fieldPlaceholders = fieldParts.map((part, partIndex) => {
              const placeholder = `#customField${index}_${partIndex}`;
              expressionAttributeNames[placeholder] = part;
              return placeholder;
            });
            fieldExpression = fieldPlaceholders.join('.');
          } else {
            const fieldPlaceholder = `#customField${index}`;
            expressionAttributeNames[fieldPlaceholder] = field;
            fieldExpression = fieldPlaceholder;
          }
          
          const valuePlaceholder = `:customValue${index}`;
          
          switch (operator) {
            case '=':
              filterExpressions.push(`${fieldExpression} = ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case '<':
              filterExpressions.push(`${fieldExpression} < ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case '>':
              filterExpressions.push(`${fieldExpression} > ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case 'contains':
              filterExpressions.push(`contains(${fieldExpression}, ${valuePlaceholder})`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            case 'begins_with':
              filterExpressions.push(`begins_with(${fieldExpression}, ${valuePlaceholder})`);
              expressionAttributeValues[valuePlaceholder] = value;
              break;
            default:
              filterExpressions.push(`${fieldExpression} = ${valuePlaceholder}`);
              expressionAttributeValues[valuePlaceholder] = value;
          }
        });
      }
      
      // Apply filter expressions if any exist
      if (filterExpressions.length > 0) {
        queryParams.FilterExpression = filterExpressions.join(' AND ');
        queryParams.ExpressionAttributeNames = expressionAttributeNames;
        queryParams.ExpressionAttributeValues = { ...queryParams.ExpressionAttributeValues, ...expressionAttributeValues };
      }

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
        console.log(`Using ExclusiveStartKey:`, JSON.stringify(lastEvaluatedKey, null, 2));
      }

      console.log(`Query ${queryCount} params:`, JSON.stringify(queryParams, null, 2));
      
      const result = await dynamodb.query(queryParams).promise();
      
      console.log(`Query ${queryCount} result: Count=${result.Count}, ScannedCount=${result.ScannedCount}, Items=${result.Items.length}`);
      console.log(`LastEvaluatedKey returned:`, result.LastEvaluatedKey ? 'exists' : 'null');
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
        console.log(`Added ${result.Items.length} items. Total so far: ${allItems.length}`);
        console.log('First item from batch created_at:', result.Items[0]?.created_at);
        console.log('Last item from batch created_at:', result.Items[result.Items.length - 1]?.created_at);
      }
      
      totalScanned += result.ScannedCount;
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      console.log(`Query ${queryCount} complete. Will continue: ${!!lastEvaluatedKey}`);
      
    } while (lastEvaluatedKey);
    
    console.log(`Pagination complete. Total items collected: ${allItems.length}, Total scanned: ${totalScanned}, Queries executed: ${queryCount}`);
    
    // Return all collected results without applying limit
    const finalResults = allItems;
    console.log(`Final results: ${finalResults.length} items`);
    
    // If no results, try a simple scan to see if table has any data
    if (finalResults.length === 0) {
      console.log('=== DEBUGGING: Trying simple scan ===');
      try {
        const scanResult = await dynamodb.scan({
          TableName: 'JitEvents',
          Limit: 1
        }).promise();
        console.log(`Scan result: Count=${scanResult.Count}, has any data: ${scanResult.Items.length > 0}`);
        if (scanResult.Items.length > 0) {
          console.log('First scan item:', JSON.stringify(scanResult.Items[0], null, 2));
        }
      } catch (scanError) {
        console.error('Scan error:', scanError);
      }
    }
    
    res.json({
      success: true,
      data: finalResults,
      count: finalResults.length,
      totalCollected: allItems.length,
      scannedCount: totalScanned,
      queriesExecuted: queryCount
    });
  } catch (error) {
    console.error('JitEvents query error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Generate S3 signed URL for file download
app.post('/api/s3-signed-url', async (req, res) => {
  try {
    const { tenantId, jitEventId, executionId } = req.body;

    if (!tenantId || !jitEventId || !executionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Generate an S3 signed URL for downloading the output file
    const s3 = new AWS.S3();
    const bucketName = 'jit-execution-outputs-prod';
    const key = `${tenantId}/${jitEventId}-${executionId}/output.zip`;

    // Create a signed URL that expires in 60 seconds
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: key,
      Expires: 60 // URL expiration time in seconds
    });

    return res.json({
      success: true,
      signedUrl,
      fileName: `output.zip`
    });
  } catch (error) {
    console.error('Error generating S3 signed URL:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate S3 signed URL for mountpoint directory download
app.post('/api/mountpoint-download', async (req, res) => {
  try {
    const { tenantId, jitEventId } = req.body;

    if (!tenantId || !jitEventId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Generate a signed URL for the mountpoint directory
    const s3 = new AWS.S3();

    // Try different possible bucket names and path formats
    // This helps diagnose potential configuration issues
    const bucketOptions = [
      { bucket: 'jit-orchestrator-mountpoint-prod', prefix: `${tenantId}/${jitEventId}/` },
    ];

    console.log(`Trying multiple bucket and path combinations for tenant: ${tenantId}, event: ${jitEventId}`);

    // Variable to track if we found files in any bucket/path combination
    let foundFiles = false;
    let bucketName, prefix, listResult;

    // Try each bucket and path combination until we find files
    try {
      for (const option of bucketOptions) {
        console.log(`Checking bucket: ${option.bucket}, prefix: ${option.prefix}`);

        try {
          listResult = await s3.listObjectsV2({
            Bucket: option.bucket,
            Prefix: option.prefix,
            MaxKeys: 10 // Increased to see more potential files
          }).promise();

          console.log(`Found ${listResult.Contents ? listResult.Contents.length : 0} files in ${option.bucket}/${option.prefix}`);

          if (listResult.Contents && listResult.Contents.length > 0) {
            // We found files - save the bucket and prefix for later use
            bucketName = option.bucket;
            prefix = option.prefix;
            foundFiles = true;
            break;
          }
        } catch (bucketError) {
          console.log(`Error checking bucket ${option.bucket}: ${bucketError.message}`);
          // Continue to the next bucket option
        }
      }

      if (!foundFiles) {
        console.error(`No files found in any of the bucket/path combinations for tenant: ${tenantId}, event: ${jitEventId}`);
        return res.status(404).json({
          success: false,
          error: 'No files found in the specified mountpoint directory',
          triedBuckets: bucketOptions.map(opt => `${opt.bucket}/${opt.prefix}`)
        });
      }

      // Create a zip file of all the objects in this directory
      // For this simplified example, we'll just return a signed URL to the directory prefix
      // In production, you would implement actual directory zipping

      // Sort the files by size to find the most relevant one (non-empty files first)
      const sortedFiles = [...listResult.Contents].sort((a, b) => b.Size - a.Size);

      // Log detailed information about found files
      console.log('Found files:');
      sortedFiles.slice(0, 5).forEach((file, index) => {
        console.log(`${index + 1}. ${file.Key} (${file.Size} bytes)`);
      });

      // Choose the first non-empty file if available, otherwise just use the first file
      const fileToDownload = sortedFiles.find(file => file.Size > 0) || sortedFiles[0];

      // Create a signed URL that expires in 5 minutes (300 seconds)
      // This gives users more time to download the file
      const signedUrl = s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileToDownload.Key,
        Expires: 300 // URL expiration time in seconds
      });

      // Extract a more meaningful filename from the key
      const keyParts = fileToDownload.Key.split('/');
      const fileName = keyParts[keyParts.length - 1] || `mountpoint-${jitEventId}-file`;

      console.log(`Generated signed URL for file: ${fileToDownload.Key} (${fileToDownload.Size} bytes)`);

      return res.json({
        success: true,
        signedUrl,
        fileName,
        fileSize: fileToDownload.Size,
        bucket: bucketName,
        key: fileToDownload.Key,
        totalFiles: listResult.Contents.length,
        expiresIn: '5 minutes'
      });
    } catch (error) {
      console.error('Error generating mountpoint download URL:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error in mountpoint download endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/stuck-pr-executions', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Calculate date range for past 2 days using UTC
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)); // Subtract 2 days in milliseconds
    const twoDaysAgoISO = twoDaysAgo.toISOString();
    
    console.log(`Searching for ALL PR events from ${twoDaysAgoISO} onwards for tenant ${tenantId} (UTC times)`);
    
    // Query JobExecutions table with correct GSI1PK format and pagination
    // NOTE: We want ALL PR events to find latest per PR, regardless of st0atus initially
    let allItems = [];
    let lastEvaluatedKey = null;
    let totalScanned = 0;
    let queryCount = 0;
    
    do {
      queryCount++;
      console.log(`Query ${queryCount}: Starting pagination query...`);
      console.log(`LastEvaluatedKey from previous query:`, lastEvaluatedKey ? 'exists' : 'null');
      
      const queryParams = {
        TableName: 'JitEvents',
        KeyConditionExpression: 'GSI1PK_TENANT_ID = :pk',
        IndexName: 'GSI1',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':prValue': 'pull_request'
        },
        FilterExpression: 'contains(#jitEventName, :prValue)',
        ExpressionAttributeNames: {
          '#jitEventName': 'jit_event_name'
        },
        Limit: 1000, // Process in batches of 1000
        ScanIndexForward: false // Sort descending by created_at
      };
      
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
        console.log(`Using ExclusiveStartKey:`, JSON.stringify(lastEvaluatedKey, null, 2));
      }

      console.log(`Query ${queryCount} params:`, JSON.stringify(queryParams, null, 2));
      
      const result = await dynamodb.query(queryParams).promise();
      
      console.log(`Query ${queryCount} result: Count=${result.Count}, ScannedCount=${result.ScannedCount}, Items=${result.Items.length}`);
      console.log(`LastEvaluatedKey returned:`, result.LastEvaluatedKey ? 'exists' : 'null');
      
      if (result.Items && result.Items.length > 0) {
        allItems = allItems.concat(result.Items);
        console.log(`Added ${result.Items.length} items. Total so far: ${allItems.length}`);
        
        // Log first and last item from this batch to understand structure
        console.log('First item from batch created_at:', result.Items[0]?.created_at);
        console.log('Last item from batch created_at:', result.Items[result.Items.length - 1]?.created_at);
      }
      
      totalScanned += result.ScannedCount;
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      console.log(`Query ${queryCount} complete. Will continue: ${!!lastEvaluatedKey}`);
      if (lastEvaluatedKey) {
        console.log(`LastEvaluatedKey details:`, JSON.stringify(lastEvaluatedKey, null, 2));
      }
      
    } while (lastEvaluatedKey);
    
    console.log(`Pagination complete. Total items collected: ${allItems.length}, Total scanned: ${totalScanned}, Queries executed: ${queryCount}`);
    
    // NEW IMPROVED ALGORITHM: Find latest event per unique PR
    const prLatestEvents = new Map(); // For finding latest event per PR
    
    allItems.forEach(item => {
      const jitEvent = item.context?.jit_event || item.jit_event || {};
      
      // Create unique PR key: owner+repo+branch+pull_request_number
      const prKey = `${jitEvent.owner}|${jitEvent.original_repository}|${jitEvent.branch}|${jitEvent.pull_request_number}`;
      
      // Skip if we can't identify the PR
      if (!jitEvent.owner || !jitEvent.original_repository || !jitEvent.pull_request_number) {
        return;
      }
      
      // Keep only the latest event for each PR (by created_at)
      if (!prLatestEvents.has(prKey) || new Date(item.created_at) > new Date(prLatestEvents.get(prKey).created_at)) {
        prLatestEvents.set(prKey, item);
      }
    });
    
    // Filter for stuck PRs: latest status is started/in_progress/job_sent
    const stuckStatuses = ['started', 'creating', 'job_sent'];
    const stuckPRs = [];
    
    prLatestEvents.forEach((latestEvent, prKey) => {
      if (stuckStatuses.includes(latestEvent.status)) {
        const jitEvent = latestEvent.context?.jit_event || latestEvent.jit_event || {};
        
        // Calculate time elapsed and urgency level
        // Fix: DynamoDB created_at lacks timezone suffix, so force UTC interpretation
        const createdAtUTC = latestEvent.created_at.endsWith('Z') ? 
          latestEvent.created_at : 
          latestEvent.created_at + 'Z';
        const createdTime = new Date(createdAtUTC);
        // Fix timezone mismatch: ensure both dates are compared in UTC
        // Use explicit UTC handling to avoid local timezone issues
        const nowUTC = new Date(); // Current time in UTC
        const elapsedMinutes = Math.floor((nowUTC - createdTime) / (1000 * 60));
        
        // Debug logging to verify timezone handling
        console.log(`DEBUG: Timezone calculation for PR ${jitEvent.pull_request_number}:`);
        console.log(`  created_at raw: ${latestEvent.created_at}`);
        console.log(`  created_at fixed: ${createdAtUTC}`);
        console.log(`  createdTime: ${createdTime.toISOString()}`);
        console.log(`  nowUTC: ${nowUTC.toISOString()}`);
        console.log(`  elapsedMinutes: ${elapsedMinutes}`);
        console.log(`  Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        
        let urgencyLevel = 'green';
        let urgencyText = 'Recent';
        if (elapsedMinutes >= 10) {
          urgencyLevel = 'red';
          urgencyText = 'Critical';
        } else if (elapsedMinutes >= 3) {
          urgencyLevel = 'orange';
          urgencyText = 'Warning';
        }
        
        // Extract required fields
        const prData = {
          jit_event_id: latestEvent.jit_event_id,
          execution_id: latestEvent.execution_id,
          created_at: latestEvent.created_at,
          status: latestEvent.status,
          jit_event_name: latestEvent.jit_event_name,
          // From jit_event payload
          branch: jitEvent.branch,
          original_repository: jitEvent.original_repository,
          owner: jitEvent.owner,
          pull_request_number: jitEvent.pull_request_number,
          pull_request_title: jitEvent.pull_request_title,
          commit_head_sha: jitEvent.commits?.head_sha,
          // Additional useful fields
          url: jitEvent.url,
          updated_at: jitEvent.updated_at,
          user_vendor_name: jitEvent.user_vendor_name,
          asset_name: latestEvent.asset_name,
          control_name: latestEvent.control_name,
          // NEW: Time and urgency information
          elapsed_minutes: elapsedMinutes,
          urgency_level: urgencyLevel,
          urgency_text: urgencyText,
          time_ago: elapsedMinutes < 60 ? 
            `${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} ago` :
            `${Math.floor(elapsedMinutes / 60)} hour${Math.floor(elapsedMinutes / 60) !== 1 ? 's' : ''} ago`
        };
        
        stuckPRs.push(prData);
      }
    });
    
    // Sort by urgency (red first, then orange, then green) and then by elapsed time (oldest first)
    stuckPRs.sort((a, b) => {
      const urgencyOrder = { 'red': 0, 'orange': 1, 'green': 2 };
      if (urgencyOrder[a.urgency_level] !== urgencyOrder[b.urgency_level]) {
        return urgencyOrder[a.urgency_level] - urgencyOrder[b.urgency_level];
      }
      return b.elapsed_minutes - a.elapsed_minutes; // Within same urgency, show oldest first
    });
    
    // Generate enhanced statistics
    const urgencyCounts = stuckPRs.reduce((acc, pr) => {
      acc[pr.urgency_level] = (acc[pr.urgency_level] || 0) + 1;
      return acc;
    }, {});
    
    const stats = {
      total_stuck_prs: stuckPRs.length,
      total_pr_events_processed: allItems.length,
      total_unique_prs_analyzed: prLatestEvents.size,
      total_scanned: totalScanned,
      queries_executed: queryCount,
      date_range_start: twoDaysAgoISO,
      // Urgency breakdown
      critical_prs: urgencyCounts.red || 0,
      warning_prs: urgencyCounts.orange || 0,
      recent_prs: urgencyCounts.green || 0,
      // Traditional stats
      repositories: [...new Set(stuckPRs.map(pr => pr.original_repository).filter(Boolean))],
      owners: [...new Set(stuckPRs.map(pr => pr.owner).filter(Boolean))],
      branches: [...new Set(stuckPRs.map(pr => pr.branch).filter(Boolean))],
      oldest_execution: stuckPRs.length > 0 ? stuckPRs[stuckPRs.length - 1].created_at : null,
      newest_execution: stuckPRs.length > 0 ? stuckPRs[0].created_at : null,
      event_types: [...new Set(stuckPRs.map(pr => pr.jit_event_name).filter(Boolean))],
      stuck_statuses: [...new Set(stuckPRs.map(pr => pr.status).filter(Boolean))]
    };

    console.log('Final processed stuck PRs:', stuckPRs.length);
    console.log('Urgency breakdown:', urgencyCounts);
    console.log('Final statistics:', stats);
    console.log('First processed PR:', stuckPRs[0] ? JSON.stringify(stuckPRs[0], null, 2) : 'No processed PRs');

    res.json({
      success: true,
      data: stuckPRs,
      statistics: stats,
      count: allItems.length,
      scannedCount: totalScanned
    });
  } catch (error) {
    console.error('Stuck PR executions query error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

app.get('/api/aws-config', async (req, res) => {
  try {
    const config = {
      region: AWS.config.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set',
      hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    };
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize app and start server
initializeApp().then(() => {
  app.listen(port, () => {
    console.log(`DynamoDB Debug Tool webapp running at http://localhost:${port}`);
  });
}).catch(error => {
  console.error('Failed to initialize app:', error);
  process.exit(1);
}); 