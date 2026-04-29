# OneTimer Bob - Quick Start & Testing Guide

## ⚡ Quick Start (5 Minutes)

### Current Status
The project foundation is complete with:
- ✅ Architecture and configuration
- ✅ Database schema
- ✅ Core utilities (encryption, logging)
- ✅ Mainframe client (z/OSMF)
- ✅ Jira client (MCP)
- ⚠️ Backend server (needs completion)
- ❌ Frontend (not started)

### What You Can Test Right Now

Since the backend server and frontend are not yet complete, here's what you can do:

## 🧪 Option 1: Test Individual Components (Recommended)

### Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 2: Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Required for testing:
# - ZOSMF_HOST=204.90.115.200
# - ZOSMF_PORT=10443
# - ZOSMF_ACCOUNT=FB3
# - JIRA_URL=your-jira-url
# - JIRA_USERNAME=your-email
# - JIRA_API_TOKEN=your-token
# - ENCRYPTION_KEY=generate-32-char-key
```

### Step 3: Start Database Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait 10 seconds for services to start
# Check status
docker-compose ps
```

### Step 4: Initialize Database

```bash
# Generate Prisma client
cd backend
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### Step 5: Test Mainframe Connection

Create a test file to verify mainframe connectivity:

```bash
# Create test file
cat > backend/test-mainframe.ts << 'EOF'
import { zosmfClient } from './src/integrations/zosmf/client';

async function testMainframe() {
  console.log('Testing mainframe connection...');
  
  // Replace with your actual TSO credentials
  const tsoId = 'Z12345'; // Your TSO ID
  const password = 'your-password'; // Your TSO password
  
  try {
    const result = await zosmfClient.authenticate(tsoId, password);
    
    if (result.success) {
      console.log('✅ Authentication successful!');
      console.log('Token:', result.token?.substring(0, 50) + '...');
      console.log('Session ID:', result.sessionId);
    } else {
      console.log('❌ Authentication failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testMainframe();
EOF

# Run the test
npx ts-node test-mainframe.ts
```

**Expected Output:**
```
Testing mainframe connection...
✅ Authentication successful!
Token: LtpaToken2=...
Session ID: xxx-xxx-xxx
```

### Step 6: Test Jira MCP Connection

Create a test file for Jira:

```bash
# Create test file
cat > backend/test-jira.ts << 'EOF'
import { mcpJiraClient } from './src/integrations/mcp/jira-client';

async function testJira() {
  console.log('Testing Jira MCP connection...');
  
  try {
    // Connect to MCP server
    await mcpJiraClient.connect();
    console.log('✅ MCP connection established');
    
    // Fetch a test issue (replace with your issue key)
    const issue = await mcpJiraClient.fetchIssue('CSR-123');
    console.log('✅ Issue fetched:', issue.key);
    console.log('Summary:', issue.fields.summary);
    
    // Transform to XML
    const xml = mcpJiraClient.transformToXML(issue);
    console.log('✅ XML transformation successful');
    console.log('XML Preview:', xml.substring(0, 200) + '...');
    
    // Disconnect
    await mcpJiraClient.disconnect();
    console.log('✅ MCP connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testJira();
EOF

# Run the test
npx ts-node test-jira.ts
```

### Step 7: Test Encryption Utilities

```bash
# Create test file
cat > backend/test-encryption.ts << 'EOF'
import { encrypt, decrypt } from './src/utils/encryption';

// Set encryption key
process.env.ENCRYPTION_KEY = 'test-key-must-be-at-least-32-characters-long';

const testPassword = 'MySecretPassword123!';

console.log('Testing encryption...');
console.log('Original:', testPassword);

const encrypted = encrypt(testPassword);
console.log('Encrypted:', encrypted);

const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);

if (testPassword === decrypted) {
  console.log('✅ Encryption/Decryption successful!');
} else {
  console.log('❌ Encryption/Decryption failed!');
}
EOF

# Run the test
npx ts-node test-encryption.ts
```

## 🚀 Option 2: Complete Backend Server (Next Step)

To run the full application, we need to complete the backend server. Here's what's needed:

### Missing Components:
1. **Backend Server Entry Point** (`backend/src/server.ts`)
2. **Authentication Controller** (`backend/src/controllers/auth.controller.ts`)
3. **Authentication Service** (`backend/src/services/auth.service.ts`)
4. **Routes** (`backend/src/routes/`)
5. **Middleware** (`backend/src/middleware/`)

### Once Complete, You'll Run:

```bash
# Development mode
npm run dev

# This will start:
# - Backend API on http://localhost:5000
# - Frontend on http://localhost:3000 (when created)
```

## 🔍 Verification Checklist

### ✅ What You Can Verify Now:

1. **Project Structure**
   ```bash
   ls -la
   # Should see: ARCHITECTURE.md, README.md, package.json, docker-compose.yml, etc.
   ```

2. **Dependencies Installed**
   ```bash
   cd backend && npm list --depth=0
   # Should show all packages from package.json
   ```

3. **Database Running**
   ```bash
   docker-compose ps
   # Should show postgres and redis as "Up"
   ```

4. **Prisma Client Generated**
   ```bash
   cd backend && ls node_modules/.prisma/client
   # Should show generated Prisma client files
   ```

5. **Database Schema Created**
   ```bash
   cd backend && npx prisma studio
   # Opens browser showing database tables
   ```

### ⚠️ What You Cannot Test Yet:

1. **Full Backend API** - Server not complete
2. **Frontend UI** - Not created yet
3. **End-to-End Flow** - Requires both frontend and backend
4. **WebSocket Real-time Updates** - Server not running

## 🐛 Troubleshooting

### Issue: "Cannot find module"

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules backend/node_modules
npm install
cd backend && npm install
```

### Issue: "Database connection failed"

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### Issue: "Mainframe timeout"

**Solution:**
```bash
# Test connectivity
curl -k https://204.90.115.200:10443/zosmf/

# If timeout, check firewall/network access
ping 204.90.115.200
```

### Issue: "MCP connection failed"

**Solution:**
```bash
# Check if podman/docker is running
podman --version
docker --version

# Pull MCP image
podman pull mcp-atlassian:latest
```

## 📊 Current Testing Status

| Component | Status | Can Test? |
|-----------|--------|-----------|
| Database Schema | ✅ Complete | ✅ Yes (Prisma Studio) |
| Encryption Utils | ✅ Complete | ✅ Yes (Unit test) |
| Logger | ✅ Complete | ✅ Yes (Unit test) |
| z/OSMF Client | ✅ Complete | ✅ Yes (Integration test) |
| MCP Jira Client | ✅ Complete | ⚠️ Partial (needs MCP server) |
| Backend Server | ❌ Not Complete | ❌ No |
| Frontend | ❌ Not Started | ❌ No |
| End-to-End | ❌ Not Ready | ❌ No |

## 🎯 Next Steps to Make It Runnable

### Priority 1: Complete Backend Server (4-6 hours)

I can create these files for you:

1. `backend/src/server.ts` - Express server setup
2. `backend/src/controllers/auth.controller.ts` - Authentication endpoints
3. `backend/src/services/auth.service.ts` - Business logic
4. `backend/src/middleware/auth.middleware.ts` - JWT verification
5. `backend/src/routes/index.ts` - Route configuration

**After this, you can run:**
```bash
npm run dev:backend
# Backend API will be accessible at http://localhost:5000
```

### Priority 2: Create Frontend (6-8 hours)

1. Initialize React app
2. Create login page
3. Connect to backend API

**After this, you can run:**
```bash
npm run dev
# Full application accessible at http://localhost:3000
```

## 💡 Quick Demo Without Full Setup

If you want to see the architecture and design without running code:

1. **Review Architecture:**
   ```bash
   cat ARCHITECTURE.md | less
   ```

2. **View Database Schema:**
   ```bash
   cat backend/prisma/schema.prisma
   ```

3. **Check Mainframe Client:**
   ```bash
   cat backend/src/integrations/zosmf/client.ts | less
   ```

4. **Review Documentation:**
   - `README.md` - Project overview
   - `SETUP_GUIDE.md` - Detailed setup
   - `PROJECT_SUMMARY.md` - Current status

## 🚀 Fastest Path to Running Application

**Option A: Complete Backend First (Recommended)**
```bash
# 1. I create the missing backend files (4-6 hours of work)
# 2. You run: npm run dev:backend
# 3. Test with Postman/curl
```

**Option B: Full Stack**
```bash
# 1. Complete backend (4-6 hours)
# 2. Create frontend (6-8 hours)
# 3. You run: npm run dev
# 4. Access at http://localhost:3000
```

## 📞 Need Help?

**Want me to complete the backend server now?**

Just say:
- "Complete the backend server" - I'll create all missing backend files
- "Create the frontend" - I'll set up the React application
- "Make it runnable" - I'll complete both backend and frontend

**Current Status:** Foundation complete, ready for implementation phase.

---

**Estimated Time to Full Running Application:** 10-14 hours of implementation work