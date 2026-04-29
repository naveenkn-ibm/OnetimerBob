# Step 4: AI-Powered Analysis - Testing Guide

## Overview
This guide covers testing the AI-powered intent extraction and entity recognition feature integrated into OneTimer Bob's workspace.

## Prerequisites

### 1. Backend Server Running
- Terminal 2 or 3: Backend running on `http://localhost:3000`
- Check logs for: `✅ Server running on http://0.0.0.0:3000`

### 2. Frontend Server Running
- Terminal 5: Frontend running on `http://localhost:5173`
- Check logs for: `Local: http://localhost:5173/`

### 3. OpenAI API Key Configuration
**IMPORTANT**: Before testing AI features, you MUST configure your OpenAI API key:

```bash
# In backend/.env file, add:
OPENAI_API_KEY=your-actual-openai-api-key-here
```

**To get an OpenAI API key:**
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key and paste it in `backend/.env`
5. Restart the backend server

**Without a valid API key, AI analysis will fail with an authentication error.**

### 4. Jira MCP Server
- MCP Atlassian server must be running
- Credentials configured in environment

## Test Scenarios

### Scenario 1: Basic AI Analysis Flow

**Objective**: Test the complete flow from Jira fetch to AI analysis

**Steps**:
1. Open browser to `http://localhost:5173`
2. Login with TSO credentials
3. Enter CSR ID: `BTP-2` (or any valid Jira issue)
4. Click "Fetch & Analyze"

**Expected Results**:
- ✅ Progress bar shows 5 steps for Jira fetch
- ✅ Jira data displays with issue details
- ✅ XML requirements render in collapsible section
- ✅ Chat panel (right side) shows system messages
- ✅ AI Analysis Results panel appears with Intent, Region, Claims, Confidence Score, Summary
- ✅ Review & Approval section appears

### Scenario 2: Edit and Re-analyze

**Objective**: Test the correction and re-analysis workflow

**Steps**:
1. Complete Scenario 1 first
2. In AI Analysis Results panel, click the **Edit** icon (pencil)
3. Modify the extracted data
4. Click "Re-analyze with Corrections"

**Expected Results**:
- ✅ Edit mode activates with input fields
- ✅ AI re-processes with corrections
- ✅ Updated results display

### Scenario 3: Approval Workflow

**Objective**: Test the review and approval process

**Steps**:
1. Complete AI analysis
2. Click "Approve Analysis"

**Expected Results**:
- ✅ Green "Analysis Approved" panel appears
- ✅ Chat panel shows approval message

## Success Criteria

Step 4 implementation is considered successful when:

1. ✅ AI analysis triggers automatically after Jira fetch
2. ✅ Intent, region, and claims are extracted accurately
3. ✅ Chat panel shows real-time progress messages
4. ✅ Confidence scoring works and displays correctly
5. ✅ Edit and re-analyze workflow functions properly
6. ✅ Approval workflow completes successfully
7. ✅ Error handling provides clear user feedback
8. ✅ UI remains responsive during processing

## Notes

- **OpenAI API Key**: Required for AI features to work
- **Test Data**: Use real Jira issues for accurate testing
- **Browser**: Tested on Chrome, Firefox, Edge