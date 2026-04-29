# Jira Credentials Reference - IBM JSW

## Configuration Status
✅ **Credentials are already configured in `backend/.env`**

## IBM Jira Software (JSW) Details

```env
JIRA_URL=https://jsw.ibm.com
JIRA_USERNAME=naveenkn@in.ibm.com
JIRA_API_TOKEN=YTaMvpiKjYWPsR7iucYYcMNEM20m5g5ebEx7rH
```

## Server Status
- ✅ Backend server running on port 3000
- ✅ Jira endpoint available: `POST /api/jira/issue`
- ✅ Environment variables loaded

## Testing with IBM Jira

### Sample Issue Keys to Test
You can test with any valid IBM JSW issue key, for example:
- `BTP-XXX` (if you have access to BTP project)
- `PROJ-XXX` (replace with your actual project key)
- Any issue key from projects you have access to

### How to Find Valid Issue Keys
1. Go to https://jsw.ibm.com
2. Login with your IBM credentials
3. Navigate to any project you have access to
4. Copy an issue key (e.g., "PROJ-123")
5. Use that key in the OneTimer Bob application

## Quick Test Steps

1. **Start Frontend** (if not running):
   ```bash
   cd frontend
   npm run dev
   ```

2. **Access Application**:
   - Open browser: http://localhost:5173
   - Login with TSO credentials
   - Click "Continue to Dashboard"

3. **Test Jira Integration**:
   - Enter a valid IBM JSW issue key
   - Click "Fetch Details"
   - Observe progress indicators
   - Verify issue data and XML display

## MCP Server Configuration

The MCP Atlassian server will use these credentials when connecting to IBM Jira:
- **Host**: https://jsw.ibm.com
- **Authentication**: Basic Auth (username + API token)
- **Transport**: Podman container via stdio

## Security Notes

⚠️ **IMPORTANT**: 
- These credentials are stored in `.env` file
- `.env` is in `.gitignore` (not committed to Git)
- Never share API tokens publicly
- Rotate tokens periodically for security

## Troubleshooting

### If Jira connection fails:
1. Verify you have access to IBM JSW
2. Check if API token is still valid
3. Ensure you're using a valid issue key from a project you can access
4. Check network connectivity to https://jsw.ibm.com

### To regenerate API token:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create new token
3. Update `JIRA_API_TOKEN` in `backend/.env`
4. Restart backend server

---

**Made with Bob** 🤖