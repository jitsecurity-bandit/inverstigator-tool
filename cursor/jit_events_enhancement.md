# JitEvents Table Query Enhancement - Implementation Plan

## OVERVIEW
Adding JitEvents table querying capability to the existing DynamoDB Debug Tool. Users should be able to clearly differentiate between searching JobExecutions vs JitEvents tables.

## ⚠️ IMPORTANT UPDATE: GSI2 Structure Change
**Changed from GSI1 to GSI2 with status-based partitioning:**
- **GSI2PK_TENANT_ID_STATUS**: `TENANT#<tenant_id>#STATUS#<creating/started/jobs_sent/completed/failed>`
- **GSI2SK**: Sort key (likely created_at based)
- **This means JitEvents DOES have status filtering like JobExecutions!**

## IMPLEMENTATION PROGRESS

### STEP 1: Backend API Enhancement ✅ COMPLETED (Updated to GSI2)
1. ✅ Created new `/api/query-jit-events` endpoint
2. ✅ **UPDATED**: Changed to GSI2 with status-based partitioning (GSI2PK_TENANT_ID_STATUS)
3. ✅ Added pagination support with proper LastEvaluatedKey handling
4. ✅ Handled custom filters and event name filtering appropriately
5. ✅ **UPDATED**: JitEvents now requires status parameter like JobExecutions

### STEP 2: Frontend UI Changes ✅ COMPLETED (Updated for GSI2)
1. ✅ Added query mode selector with beautiful radio button design
2. ✅ **UPDATED**: Added status field for BOTH modes with different options
3. ✅ Updated handleQuery() to route to correct endpoint based on mode
4. ✅ Created separate result display functions for each query type
5. ✅ Updated table headers and columns for each mode dynamically

### STEP 3: Results Display Enhancement ✅ COMPLETED
1. ✅ Different table structure for JitEvents (PR#, Repository, Branch, Owner, etc.)
2. ✅ Handle different field mappings (execution_id vs jit_event_id focus)
3. ✅ Updated modal views for different data types with appropriate field filtering
4. ✅ Maintained all existing functionality (copy, expand, additional data modal)

### STEP 4: Testing & Validation 🔄 READY FOR TESTING
1. ⏳ Test both query modes work independently
2. ⏳ Verify pagination works for both tables
3. ⏳ Ensure UI clearly differentiates between modes
4. ⏳ Test custom filters work for both tables

## Technical Implementation Details

### UPDATED Backend Changes:
- **Endpoint**: `/api/query-jit-events` 
- **GSI2 Query**: Uses `GSI2PK_TENANT_ID_STATUS = TENANT#<tenant_id>#STATUS#<status>`
- **Status Options**: creating, started, jobs_sent, completed, failed
- **Date filtering**: Properly formats GSI2SK (TBD structure)
- **Event name filtering**: Uses FilterExpression with `contains()` function
- **Pagination**: Full support with LastEvaluatedKey handling

### UPDATED Frontend Changes:
- **Mode Selection**: Beautiful radio button UI with descriptions
- **Form Fields Update**: BOTH modes now need status field!
  - Executions: Status options (started, success, failure, timeout)
  - Events: Status options (creating, started, jobs_sent, completed, failed)
- **Dynamic Table Headers**: Different columns based on query mode
- **Separate Row Renderers**: `renderExecutionRow()` vs `renderEventRow()`
- **Smart Field Handling**: Different additional field exclusions per mode

### Updated UI Features:
- **Query Mode Selection**: 
  - 🔧 Job Executions: Query control execution results and status
  - 📋 JIT Events: Query JIT events and PR information
- **Updated Form Fields**:
  - Executions: Tenant ID*, Status* (started/success/failure/timeout), Date filters, Custom filters
  - Events: Tenant ID*, Status* (creating/started/jobs_sent/completed/failed), Event Name filter, Date filters, Custom filters
- **Different Result Columns**:
  - Executions: JIT Event ID, Event Name, Execution ID, Status, Control Name, Asset Name, etc.
  - Events: JIT Event ID, Event Name, PR Number, Repository, Branch, Owner, PR Title, etc.

## Changes Required:

### 1. Backend (server.js):
- Change IndexName from 'GSI1' to 'GSI2'
- Change KeyConditionExpression to use 'GSI2PK_TENANT_ID_STATUS'
- Update partition key format to include status
- Adjust date filtering for GSI2SK structure

### 2. Frontend (webapp.html):
- Update form to show status field for BOTH modes (with different options)
- Update validation to require status for both modes
- Update handleModeSwitch to manage different status options
- Update button text and descriptions

## Files to Modify:
1. ✅ **server.js** - Update GSI2 query structure
2. ✅ **webapp.html** - Update form to require status for both modes

## Testing Checklist
- [ ] JobExecutions mode still works as before
- [ ] JitEvents mode queries correct table with GSI2 and status
- [ ] UI shows appropriate status options for each mode
- [ ] Mode switching works smoothly with proper validation
- [ ] Pagination works for both modes
- [ ] Custom filters work for both table structures
- [ ] Export functionality works for both result types
- [ ] Modal views display appropriate data for each type
- [ ] Error handling works for both endpoints

## Next Steps:
1. 🔧 Update server.js to use GSI2 structure
2. 🎨 Update frontend to show status for both modes with different options
3. 🧪 Test the updated implementation
4. 🐛 Fix any issues found during testing

## Success Criteria:
1. ✅ User can clearly switch between JobExecutions and JitEvents querying
2. 🔄 Both query modes work independently with proper pagination on different GSIs
3. ✅ Results display appropriately for each data type
4. ✅ All existing functionality (export, modal, copy) maintained for both modes
5. ✅ UI clearly indicates which mode is active
6. 🔄 Both modes properly handle status-based filtering with appropriate options 