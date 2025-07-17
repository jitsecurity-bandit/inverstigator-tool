# Deep Research: Add kubectl logs command copy to job executions table

## Task Overview
Add an action button to the job executions table that copies a kubectl command to get logs for a specific execution.

## Required Command Format
```
POD_NAME=$(kubectl-prod -n <tenant_id> get pods --no-headers | grep "<first part of execution_id uuid>" | awk '{print $1}')
kubectl-prod -n <tenant_id> logs $POD_NAME
```

## Research Plan
1. Find the job executions table component
2. Understand the current actions implementation
3. Identify where tenant_id and execution_id are available
4. Implement the copy functionality
5. Add the new action to the table
6. Test the implementation

## Progress
- [x] Find job executions table component
- [x] Analyze current actions structure
- [x] Identify data sources (tenant_id, execution_id)
- [ ] Implement copy functionality
- [ ] Add action button
- [ ] Test implementation

## Findings
### Location: webapp.html
- Job executions table in `renderExecutionRow()` function (line ~1816)
- Current actions in actions-cell: View All, Copy ID, Expand
- Current `copyToClipboard(text)` function exists (line ~2015)
- tenant_id is available from form input: `document.getElementById('tenant-id').value.trim()`
- execution_id is available in each item: `item.execution_id`

### Current Actions Structure:
```html
<td class="actions-cell">
    <button class="action-btn view" onclick="viewDetails('${executionId}')">View All</button>
    <button class="action-btn copy" onclick="copyToClipboard('${executionId}')">Copy ID</button>
    <button class="action-btn expand-row" onclick="openRecordModal(${index})">Expand</button>
</td>
```

### Implementation Plan:
1. Create new function `copyKubectlLogsCommand(executionId)` 
2. Add new action button "Copy kubectl logs" in renderExecutionRow()
3. Function will:
   - Get tenant_id from form
   - Extract first part of execution_id (before first hyphen)
   - Generate the kubectl command string
   - Copy to clipboard

## Notes
- Need to extract first part of execution_id UUID
- Need access to tenant_id from the form
- Should use existing clipboard API 