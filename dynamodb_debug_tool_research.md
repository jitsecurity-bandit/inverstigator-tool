# DynamoDB Debug Tool Research & Implementation Plan

## Research Phase

### Current Understanding:
- Need to query JobExecutions table
- GSI1 index with GSI1PK and GSI1SK structure
- Query pattern: GSI1PK = TENANT#<tenant_id>#STATUS#<status>
- GSI1SK optional filter: GT datetime in ISO format
- Display fields: jit_event_id, execution_id, status, errors, created_at, completed_at

### Research Tasks:
1. [x] Find JobExecutions table definition/schema
2. [x] Understand current DynamoDB connection/configuration
3. [x] Identify existing models/types for JobExecutions
4. [x] Research GSI1 index structure
5. [x] Check existing AWS SDK usage patterns in codebase

### Implementation Plan:
1. [x] Create Electron app structure
2. [x] Set up DynamoDB client connection
3. [x] Create query interface for JobExecutions
4. [x] Build UI with filters (tenant_id, status, datetime)
5. [x] Display results in table format
6. [x] Add export functionality
7. [x] Package for easy sharing

## Findings:

### Execution Models Found:
1. **ExecutionStatus enum** in `pr_agent/models/event_models.py`:
   - PENDING = "pending"
   - STARTED = "started"
   - SUCCESS = "success"
   - ERROR = "error"

2. **JobExecutionStatus** from jit-utils (imported in various files):
   - SUCCESS, FAILURE, TIMEOUT statuses found in usage

3. **Execution Model** in `pr_agent/models/event_models.py`:
   - execution_id: str
   - event_id: str (maps to jit_event_id)
   - asset_id: str
   - control_name: str
   - status: ExecutionStatus
   - args: Dict[str, Any]
   - timeout: int

4. **JobEntity Model** in `pr_agent/models/jit_event_models.py`:
   - job_id: str
   - asset_id: str
   - event_id: str
   - status: JobStatus
   - results: Optional[Dict[str, Any]]
   - created_at: str
   - completed_at: Optional[str]

### AWS/DynamoDB Usage:
- boto3==1.38.10 in requirements.txt
- AWS credentials configured in .secrets.toml
- DynamoDB client used in various places
- IAM Anywhere authentication for on-prem deployments

### Status Values to Support:
- started/success/failure/timeout (from requirement)
- Maps to STARTED/SUCCESS/ERROR/TIMEOUT in codebase

### DynamoDB Configuration:
- Table likely managed by jit-utils/Event Service
- Uses AWS SDK with IAM Anywhere for auth
- GSI1 pattern: TENANT#<tenant_id>#STATUS#<status>
- Region: us-east-1 (from config)

## Implementation Progress:
1. [x] Created Electron app structure
2. [x] Set up DynamoDB client with AWS SDK
3. [x] Created query interface with filters
4. [x] Built modern UI with React-like components
5. [x] Added table display with sorting/filtering
6. [x] Added export functionality (JSON/CSV)
7. [x] Packaged for easy sharing 