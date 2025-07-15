const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');
const { spawn } = require('child_process');

let mainWindow;
let currentAwsProfile = null;

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Create menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Switch AWS Profile...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow.webContents.send('show-profile-selector');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Results...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('export-results');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Function to execute commands with aws-vault
function executeWithAwsVault(profile, command, args = []) {
  return new Promise((resolve, reject) => {
    const awsVaultArgs = ['exec', profile, '--', command, ...args];
    const child = spawn('aws-vault', awsVaultArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Function to get AWS credentials using aws-vault
async function getAwsCredentialsWithVault(profile) {
  try {
    const env = await executeWithAwsVault(profile, 'env');
    const lines = env.split('\n');
    const credentials = {};
    
    lines.forEach(line => {
      if (line.includes('AWS_ACCESS_KEY_ID=')) {
        credentials.accessKeyId = line.split('=')[1];
      } else if (line.includes('AWS_SECRET_ACCESS_KEY=')) {
        credentials.secretAccessKey = line.split('=')[1];
      } else if (line.includes('AWS_SESSION_TOKEN=')) {
        credentials.sessionToken = line.split('=')[1];
      } else if (line.includes('AWS_REGION=')) {
        credentials.region = line.split('=')[1];
      }
    });

    return credentials;
  } catch (error) {
    throw new Error(`Failed to get credentials for profile ${profile}: ${error.message}`);
  }
}

// Function to update AWS configuration with new profile
async function updateAwsConfig(profile) {
  try {
    const credentials = await getAwsCredentialsWithVault(profile);
    
    AWS.config.update({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      region: credentials.region || 'us-east-1'
    });

    // Update DynamoDB client
    const dynamodbNew = new AWS.DynamoDB.DocumentClient();
    Object.setPrototypeOf(dynamodb, Object.getPrototypeOf(dynamodbNew));
    Object.assign(dynamodb, dynamodbNew);

    currentAwsProfile = profile;
    return true;
  } catch (error) {
    console.error('Error updating AWS config:', error);
    throw error;
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('set-aws-profile', async (event, profile) => {
  try {
    await updateAwsConfig(profile);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-available-profiles', async () => {
  try {
    // Get available aws-vault profiles
    const output = await executeWithAwsVault('', 'aws-vault', ['list', '--profiles']);
    const profiles = output.split('\n')
      .filter(line => line.trim())
      .map(line => line.trim());
    
    // Add our known profiles
    const knownProfiles = ['jit-rocket-admin', 'jit-prod'];
    const availableProfiles = [...new Set([...knownProfiles, ...profiles])];
    
    return { success: true, profiles: availableProfiles };
  } catch (error) {
    // Fallback to known profiles if aws-vault list fails
    return { success: true, profiles: ['jit-rocket-admin', 'jit-prod'] };
  }
});

ipcMain.handle('query-dynamodb', async (event, params) => {
  try {
    if (!currentAwsProfile) {
      return {
        success: false,
        error: 'No AWS profile selected. Please select a profile first.'
      };
    }

    const { tenantId, status, startDate, endDate, limit = 50, customFilters = [] } = params;
    
    // Build the query parameters
    const queryParams = {
      TableName: 'JobExecutions',
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}#STATUS#${status}`
      },
      Limit: limit,
      ScanIndexForward: false // Get latest first
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
            const fieldPlaceholder = `#customField${index}`;
            const valuePlaceholder = `:customValue${index}`;
            
            // Add field name to expression attribute names
            expressionAttributeNames[fieldPlaceholder] = field;
            
            // Handle different operators
            switch (operator) {
                case '=':
                    filterExpressions.push(`${fieldPlaceholder} = ${valuePlaceholder}`);
                    expressionAttributeValues[valuePlaceholder] = value;
                    break;
                case '<':
                    filterExpressions.push(`${fieldPlaceholder} < ${valuePlaceholder}`);
                    expressionAttributeValues[valuePlaceholder] = value;
                    break;
                case '>':
                    filterExpressions.push(`${fieldPlaceholder} > ${valuePlaceholder}`);
                    expressionAttributeValues[valuePlaceholder] = value;
                    break;
                case 'contains':
                    filterExpressions.push(`contains(${fieldPlaceholder}, ${valuePlaceholder})`);
                    expressionAttributeValues[valuePlaceholder] = value;
                    break;
                case 'begins_with':
                    filterExpressions.push(`begins_with(${fieldPlaceholder}, ${valuePlaceholder})`);
                    expressionAttributeValues[valuePlaceholder] = value;
                    break;
                default:
                    // Default to equals
                    filterExpressions.push(`${fieldPlaceholder} = ${valuePlaceholder}`);
                    expressionAttributeValues[valuePlaceholder] = value;
            }
        });
        
        if (filterExpressions.length > 0) {
            queryParams.FilterExpression = filterExpressions.join(' AND ');
            queryParams.ExpressionAttributeNames = expressionAttributeNames;
            queryParams.ExpressionAttributeValues = { ...queryParams.ExpressionAttributeValues, ...expressionAttributeValues };
        }
    }

    console.log(`Querying DynamoDB with profile ${currentAwsProfile} and params:`, queryParams);
    
    const result = await dynamodb.query(queryParams).promise();
    
    // Debug logging: log the first few items to understand structure
    if (result.Items && result.Items.length > 0) {
      console.log('First item structure:', JSON.stringify(result.Items[0], null, 2));
      console.log('Total items returned:', result.Items.length);
      
      // Check if jit_event_name field exists in items
      const itemsWithField = result.Items.filter(item => item.jit_event_name);
      console.log('Items with jit_event_name field:', itemsWithField.length);
      
      if (itemsWithField.length > 0) {
        console.log('Sample jit_event_name values:', 
          itemsWithField.slice(0, 3).map(item => item.jit_event_name)
        );
      }
    } else {
      console.log('No items returned from query');
    }
    
    return {
      success: true,
      data: result.Items || [],
      count: result.Count,
      scannedCount: result.ScannedCount,
      profile: currentAwsProfile
    };
  } catch (error) {
    console.error('DynamoDB query error:', error);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
});

ipcMain.handle('export-to-file', async (event, { data, format, filename }) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        format === 'json' 
          ? { name: 'JSON Files', extensions: ['json'] }
          : { name: 'CSV Files', extensions: ['csv'] }
      ]
    });

    if (filePath) {
      let content;
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else {
        // Convert to CSV
        if (data.length === 0) {
          content = '';
        } else {
          const headers = Object.keys(data[0]);
          const csvRows = [headers.join(',')];
          
          for (const row of data) {
            const values = headers.map(header => {
              const value = row[header];
              // Handle nested objects and arrays
              if (typeof value === 'object' && value !== null) {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
              }
              // Escape quotes in strings
              return `"${String(value || '').replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
          }
          content = csvRows.join('\n');
        }
      }

      fs.writeFileSync(filePath, content);
      return { success: true, filePath };
    }
    
    return { success: false, cancelled: true };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-aws-config', async () => {
  try {
    const config = {
      region: AWS.config.region,
      accessKeyId: AWS.config.credentials?.accessKeyId ? 'Set' : 'Not set',
      hasCredentials: !!AWS.config.credentials,
      currentProfile: currentAwsProfile
    };
    return config;
  } catch (error) {
    return { error: error.message };
  }
}); 