# Step 3: Jira CSR Retrieval via MCP - Testing Guide

## Overview
This guide covers testing the Jira integration via Model Context Protocol (MCP) for retrieving CSR/Issue details from Jira.

## Prerequisites

### 1. MCP Atlassian Server Setup
Before testing, ensure the MCP Atlassian server is properly configured:

```bash
# Check if Podman is installed
podman --version

# Verify MCP Atlassian image exists
podman images | grep mcp-atlassian

# If image doesn't exist, pull/build it
# (Instructions should be provided by your Jira admin)
```

### 2. Environment Variables
Ensure these environment variables are set in your backend `.env` file:

```env
# Jira Configuration (for MCP)
JIRA_URL=https://your-jira-instance.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token
```

**Note**: Get your Jira API token from: https://id.atlassian.com/manage-profile/security/api-tokens

### 3. Running Servers
Ensure both servers are running:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Expected output:
```
Server running on: http://0.0.0.0:3000
POST   /api/jira/issue  ← New endpoint
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Expected output:
```
Local:   http://localhost:5173/
```

---

## Test Scenarios

### Test 1: Basic Jira Connection via MCP

**Objective**: Verify MCP can connect to Jira and retrieve issue data

**Steps**:
1. Open browser to `http://localhost:5173`
2. Login with your TSO credentials
3. Click "Continue to Dashboard" after successful authentication
4. You should see the Workspace with CSR input field

**Expected Result**:
- ✅ Workspace loads without errors
- ✅ CSR input field is visible
- ✅ "Fetch Details" button is enabled

---

### Test 2: Fetch Valid Jira Issue

**Objective**: Retrieve a real Jira issue and display structured XML

**Steps**:
1. In the CSR input field, enter a valid Jira issue key (e.g., `PROJ-123`, `BTP-456`)
2. Click "Fetch Details" button
3. Observe the 5-step progress indicators:
   - 🟡 Step 1: Connecting to Jira via MCP
   - 🟡 Step 2: Authenticating
   - 🟡 Step 3: Fetching issue details
   - 🟡 Step 4: Parsing response
   - 🟡 Step 5: Rendering XML

**Expected Result**:
- ✅ All progress steps turn green (🟢) sequentially
- ✅ Issue data displays in the main panel with:
  - Issue Key
  - Summary
  - Description
  - Status
  - Type
  - Priority
  - Assignee
  - Labels
  - Created/Updated dates
- ✅ XML section shows properly formatted XML with all fields
- ✅ Both sections are collapsible/expandable

**Backend Logs to Check**:
```
[info]: Fetching Jira issue via MCP { issueKey: 'PROJ-123' }
[info]: Initializing MCP Atlassian client...
[info]: MCP Atlassian client connected successfully
[info]: Successfully fetched Jira issue { issueKey: 'PROJ-123' }
```

---

### Test 3: Invalid Issue Key

**Objective**: Verify error handling for non-existent issues

**Steps**:
1. Enter an invalid issue key (e.g., `INVALID-999`)
2. Click "Fetch Details"

**Expected Result**:
- ✅ Progress indicators show red (🔴) at the step where error occurs
- ✅ Error message displays: "Issue not found" or similar
- ✅ Error persists on screen (doesn't disappear)
- ✅ User can retry with a different issue key

**Backend Logs to Check**:
```
[error]: Failed to fetch Jira issue via MCP
Error: Issue not found
```

---

### Test 4: Empty Issue Key

**Objective**: Verify validation for empty input

**Steps**:
1. Leave CSR input field empty
2. Click "Fetch Details"

**Expected Result**:
- ✅ Error message: "Please enter a CSR/Issue ID"
- ✅ No API call is made
- ✅ Progress indicators don't appear

---

### Test 5: MCP Connection Failure

**Objective**: Test behavior when MCP server is unavailable

**Steps**:
1. Stop the MCP Atlassian server (if running separately)
2. Enter a valid issue key
3. Click "Fetch Details"

**Expected Result**:
- ✅ Progress stops at "Connecting to Jira via MCP" step
- ✅ Red indicator (🔴) on Step 1
- ✅ Error message: "Failed to connect to Jira via MCP"
- ✅ User can retry after MCP server is restored

---

### Test 6: XML Format Validation

**Objective**: Verify XML structure is correct and well-formed

**Steps**:
1. Fetch a valid issue
2. Expand the XML section
3. Copy the XML content
4. Paste into an XML validator (e.g., https://www.xmlvalidation.com/)

**Expected XML Structure**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jira-issue>
  <key>PROJ-123</key>
  <summary>Issue summary here</summary>
  <description>Description text</description>
  <issue-type>Story</issue-type>
  <status>In Progress</status>
  <priority>High</priority>
  <assignee>
    <name>John Doe</name>
    <email>john.doe@company.com</email>
  </assignee>
  <reporter>
    <name>Jane Smith</name>
    <email>jane.smith@company.com</email>
  </reporter>
  <created>2024-01-15T10:30:00.000Z</created>
  <updated>2024-01-20T14:45:00.000Z</updated>
  <labels>
    <label>frontend</label>
    <label>urgent</label>
  </labels>
</jira-issue>
```

**Expected Result**:
- ✅ XML is valid and well-formed
- ✅ All special characters are properly escaped
- ✅ No syntax errors

---

### Test 7: Review & Approval Workflow

**Objective**: Test the approve/request changes functionality

**Steps**:
1. Fetch a valid issue
2. Review the displayed data
3. Click "Approve" button

**Expected Result**:
- ✅ Status indicator changes to "🟢 Approved"
- ✅ Approval confirmation message appears
- ✅ System logs approval event
- ✅ Requirements are locked (no further edits)

**Alternative Flow - Request Changes**:
1. Click "Request Changes" instead
2. Enter feedback in the text area
3. Submit changes

**Expected Result**:
- ✅ Status changes to "🔵 Updated"
- ✅ Feedback is captured
- ✅ User can re-fetch or modify

---

### Test 8: Multiple Issue Fetches

**Objective**: Verify system handles multiple sequential requests

**Steps**:
1. Fetch issue `PROJ-123`
2. Wait for completion
3. Fetch issue `PROJ-456`
4. Wait for completion
5. Fetch issue `PROJ-789`

**Expected Result**:
- ✅ Each fetch completes successfully
- ✅ Previous issue data is replaced with new data
- ✅ No memory leaks or performance degradation
- ✅ MCP connection is reused efficiently

---

## Troubleshooting

### Issue: "Failed to connect to Jira via MCP"

**Possible Causes**:
1. MCP Atlassian server not running
2. Incorrect Jira credentials in `.env`
3. Podman not installed or not running
4. Network/firewall blocking connection

**Solutions**:
```bash
# Check Podman status
podman ps

# Verify environment variables
echo $JIRA_URL
echo $JIRA_USERNAME
# Don't echo JIRA_API_TOKEN for security

# Test MCP server manually
podman run -i --rm \
  -e JIRA_URL \
  -e JIRA_USERNAME \
  -e JIRA_API_TOKEN \
  mcp-atlassian:latest
```

### Issue: "No content returned from MCP tool"

**Possible Causes**:
1. MCP tool response format changed
2. Jira API returned unexpected data
3. Issue doesn't exist

**Solutions**:
- Check backend logs for detailed error
- Verify issue key is correct
- Test with a known valid issue

### Issue: XML not displaying correctly

**Possible Causes**:
1. Special characters not escaped
2. Frontend rendering issue
3. Data format mismatch

**Solutions**:
- Check browser console for errors
- Verify XML escaping in `jira.service.ts`
- Test with simple issue (no special characters)

---

## Success Criteria

Step 3 is considered **COMPLETE** when:

- ✅ MCP connection to Jira works reliably
- ✅ Valid issues can be fetched and displayed
- ✅ XML generation is correct and well-formed
- ✅ Error handling works for all failure scenarios
- ✅ Progress indicators update in real-time
- ✅ Review & approval workflow functions properly
- ✅ Multiple sequential fetches work without issues
- ✅ All test scenarios pass

---

## Next Steps

After Step 3 is complete and tested:
1. User will provide instructions for Step 4 (Task Generation)
2. AI-powered analysis and workflow automation
3. Multi-turn conversation implementation
4. Advanced features and integrations

---

## Notes

- Keep backend terminal open to monitor logs
- Use browser DevTools Network tab to inspect API calls
- Check WebSocket connection for real-time updates
- Report any unexpected behavior immediately

**Made with Bob** 🤖