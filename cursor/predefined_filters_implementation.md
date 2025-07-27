# Predefined Filters Implementation Plan

## Goal
Add predefined filter dropdown options for common fields like:
- jit_event_name
- jit_event_id
- pull_request_number
- asset_name
- execution_id
- control_name
- status
- tenant_id
- branch
- owner
- original_repository
- user_vendor_name

## Current State Analysis
✅ Custom filters are already implemented in webapp.html
✅ Server.js already handles customFilters array in both /api/query and /api/query-jit-events endpoints
✅ Current UI has text input for field names with placeholder showing examples

## Implementation Plan

### Phase 1: Update Filter UI ✅
1. ✅ Replace text input with select dropdown for field selection
2. ✅ Add predefined field options with user-friendly labels
3. ✅ Keep "Custom" option for manual field entry
4. ✅ Update styling to match existing design

### Phase 2: Test Implementation ✅
1. ✅ Test predefined filters with various field types
2. ✅ Verify nested field paths work correctly
3. ✅ Test custom field input still works

### Phase 3: Enhancement (if needed)
1. Add field-specific operators (e.g., date fields should have date operators)
2. Add field-specific value input types (e.g., date picker for date fields)

## Field Mapping
- "JIT Event Name" → "jit_event_name"
- "JIT Event ID" → "jit_event_id" 
- "Execution ID" → "execution_id"
- "Pull Request Number" → "context.jit_event.pull_request_number" / "jit_event.pull_request_number"
- "Asset Name" → "asset_name"
- "Control Name" → "control_name"
- "Branch" → "context.jit_event.branch" / "jit_event.branch"
- "Repository Owner" → "context.jit_event.owner" / "jit_event.owner"
- "Repository Name" → "context.jit_event.original_repository" / "jit_event.original_repository"
- "User Name" → "context.jit_event.user_vendor_name" / "jit_event.user_vendor_name"
- "Commit SHA" → "context.jit_event.commits.head_sha" / "jit_event.commits.head_sha"
- "PR Title" → "context.jit_event.pull_request_title" / "jit_event.pull_request_title"
- "URL" → "context.jit_event.url" / "jit_event.url"
- "Custom Field" → (allow manual entry)

## Progress
- ✅ Phase 1: Update UI
- ✅ Phase 2: Test implementation  
- [ ] Phase 3: Enhancements (if time permits)

## Implementation Details
✅ Updated addCustomFilter() function with dropdown containing organized field groups:
- Job Execution Fields (jit_event_id, execution_id, etc.)
- Git/PR Fields (context.jit_event.* paths)
- JIT Event Fields (jit_event.* paths for JIT Events table)
- Other fields (created_at, updated_at, custom)

✅ Added handleFieldChange() function to show/hide custom field input
✅ Updated getCustomFilters() to handle both dropdown and custom field values
✅ Updated CSS styles for new elements with proper grid layout

## Testing Results
✅ Created test_filters.html to validate functionality
✅ Predefined field selection works correctly
✅ Custom field input shows/hides properly when "Custom Field..." is selected
✅ getCustomFilters() correctly extracts field names from both predefined and custom inputs
✅ All field types and operators work as expected

## Testing TODO
- ✅ Test with actual data to verify field paths work
- ✅ Test custom field functionality
- ✅ Test across different query modes (executions vs events)

## COMPLETE ✅
The predefined filter functionality has been successfully implemented:
1. ✅ Dropdown with organized field groups for easy selection
2. ✅ Support for both JobExecutions and JitEvents table field paths
3. ✅ Fallback to custom field input for any unlisted fields
4. ✅ Maintains backward compatibility with existing custom filter system
5. ✅ Proper styling that matches the existing design
6. ✅ Tested and verified functionality works correctly 