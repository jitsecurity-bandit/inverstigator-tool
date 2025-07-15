# Timezone Mismatch Debug Analysis

## Issue Description
- User tested with a `created_at` that was 1 minute ago (UTC)
- System shows it as red/critical (meaning >10 minutes)
- This suggests the elapsed time calculation is wrong

## Current Code Analysis
```javascript
const createdTime = new Date(latestEvent.created_at); // This is already UTC from DynamoDB        
const nowUTC = Date.now(); // UTC milliseconds since epoch
const createdUTC = createdTime.getTime(); // UTC milliseconds since epoch
const elapsedMinutes = Math.floor((nowUTC - createdUTC) / (1000 * 60));
```

## Root Cause Analysis
1. `Date.now()` returns UTC milliseconds - CORRECT
2. `new Date(latestEvent.created_at)` - if `created_at` is ISO string, this should be UTC - CORRECT
3. `createdTime.getTime()` - returns UTC milliseconds - CORRECT

## Potential Issues
1. **Server timezone**: If the server is running in a different timezone, `new Date()` constructor might be interpreting the ISO string incorrectly
2. **ISO string format**: If `created_at` is not a proper ISO string with Z suffix, it might be interpreted as local time
3. **DynamoDB timestamp format**: Need to verify the exact format of `created_at` from DynamoDB

## Investigation Plan
1. Log the actual values of `created_at`, `createdTime`, `nowUTC`, `createdUTC`, and `elapsedMinutes`
2. Check the server's timezone settings
3. Verify the exact format of `created_at` from DynamoDB
4. Test with explicit UTC handling

## Implementation Plan
- [x] Add debug logging to see actual values
- [x] Fix the timezone handling to ensure proper UTC comparison
- [ ] Test the fix

## Solution Implemented
Changed from:
```javascript
const nowUTC = Date.now(); // UTC milliseconds since epoch
const createdUTC = createdTime.getTime(); // UTC milliseconds since epoch
const elapsedMinutes = Math.floor((nowUTC - createdUTC) / (1000 * 60));
```

To:
```javascript
const nowUTC = new Date(); // Current time in UTC
const elapsedMinutes = Math.floor((nowUTC - createdTime) / (1000 * 60));
```

## Key Fix
- Simplified the calculation by directly subtracting Date objects
- Both `createdTime` and `nowUTC` are Date objects that handle UTC correctly
- Added comprehensive debug logging to verify the fix
- The issue was likely mixing `Date.now()` (milliseconds) with `new Date()` operations 

## Root Cause Found!
From debug logs:
```
created_at raw: 2025-07-15T09:20:17.303291
createdTime: 2025-07-15T06:20:17.303Z
```

**ISSUE**: DynamoDB `created_at` is missing timezone suffix (`Z`), so JavaScript interprets it as LOCAL time (Asia/Jerusalem = UTC+3), then converts to UTC by subtracting 3 hours!

- Raw: `2025-07-15T09:20:17.303291` (no timezone = treated as local)
- Parsed: `2025-07-15T06:20:17.303Z` (converted to UTC by subtracting 3 hours)
- This makes a 1-minute-old record appear 3 hours old!

## Solution
Force UTC interpretation by appending 'Z' to the timestamp before parsing. 