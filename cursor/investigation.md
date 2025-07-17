# Bug Investigation: Query Job Executions Button Not Working Initially

## Issue Description
- User opens the app and tries to query job executions
- Fills in query filters and hits "Query Job Executions" button
- Nothing happens
- If user switches to JIT Events tab and comes back to Job Executions tab, it magically works

## Root Cause Analysis Plan
1. Examine the tab switching logic and query mode handling
2. Check the form submission and event listener setup
3. Look for any initialization issues or missing event handlers
4. Identify why switching tabs fixes the issue

## Investigation Progress

### Step 1: Examining the code structure
- Tab switching functionality
- Query mode selection and event handling
- Form submission logic

### Findings

#### Initial State Analysis
1. **HTML Initial State:**
   - `mode-executions` radio button has `checked` attribute
   - Its parent label has `active` class
   - Status field (`#status-group`) is visible
   - Event status field (`#event-status-group`) should be hidden with `hidden` class

2. **Event Listener Setup (DOMContentLoaded):**
   - `setupEventListeners()` is called
   - Form submit handler is attached
   - Radio button change listeners are attached
   - But `handleModeSwitch` is NOT called during initialization!

3. **The Problem:**
   - The HTML has the correct initial state in markup
   - But `handleModeSwitch` function is never called on page load
   - This means the required field validation and form state may not be properly set up
   - The `statusField.required = true` and `eventStatusField.required = false` lines never execute initially

4. **Why switching tabs fixes it:**
   - When user switches to JIT Events tab, the change event fires
   - `handleModeSwitch` gets called for the first time
   - Then when switching back to Job Executions, `handleModeSwitch` gets called again
   - This properly sets up the form field validation and state

### Root Cause
**The `handleModeSwitch` function is never called during page initialization, so the form field validation state is not properly configured initially.**

### Implementation Plan
1. Call `handleModeSwitch` during initialization to ensure proper form state
2. Test the fix to ensure it works correctly 