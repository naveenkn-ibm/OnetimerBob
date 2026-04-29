# OneTimer Bob - AI-Powered Enterprise Application

An AI-powered, enterprise-grade application that replicates and enhances the IBM BOB experience for healthcare claims processing with seamless mainframe and Jira integration.

## 🌟 Features

- **TSO Mainframe Authentication** - Secure connection to IBM z/OSMF with real-time progress feedback
- **Jira Integration via MCP** - Retrieve and analyze CSR/Issue data from Jira
- **AI-Powered Analysis** - OpenAI GPT-4o-mini for intelligent claim processing and task generation
- **Multi-Turn Conversations** - Context-aware AI assistant maintaining conversation history
- **Task Orchestration** - Dynamic workflow generation with approval mechanisms
- **Enterprise UI/UX** - Modern glass morphism design with pixel-perfect attention to detail
- **Real-Time Progress Tracking** - WebSocket-based live updates during operations
- **XML Rendering** - Structured display of requirements with copy/download capabilities

## 🚀 Quick Start

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- Access to IBM Mainframe (z/OSMF at 204.90.115.200:10443)
- Valid TSO credentials (format: Z#####)
- Jira access credentials (for MCP integration)
- OpenAI API key

### Option 1: Automated Startup (Windows)

Simply double-click the startup script:

```bash
start-dev.bat
```

This will:
1. Install all dependencies
2. Start backend server (port 3000)
3. Start frontend application (port 5173)
4. Open two terminal windows showing real-time logs

### Option 2: Automated Startup (Mac/Linux)

```bash
./start-dev.sh
```

### Option 3: Manual Startup

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

Wait for: `[INFO] Server listening on port 3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Wait for: `Local: http://localhost:5173/`

**Then open browser to:** http://localhost:5173

## 📋 Configuration

### Backend Environment Variables

Create `backend/.env` file:

```env
# Application
NODE_ENV=development
PORT=3000

# Mainframe Configuration (from VSC1.pdf)
ZOSMF_HOST=204.90.115.200
ZOSMF_PORT=10443
ZOSMF_ACCOUNT=FB3
ZOSMF_PROTOCOL=https
NODE_TLS_REJECT_UNAUTHORIZED=0

# Jira Configuration
JIRA_URL=https://jsw.ibm.com
JIRA_USERNAME=your-email@ibm.com
JIRA_API_TOKEN=your-jira-api-token

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend Environment Variables

Create `frontend/.env` file:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

## 🧪 Testing the Application

### 1. Backend Health Check

Open browser to:
```
http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "OneTimer Bob backend is running",
  "timestamp": "2026-04-29T07:15:00.000Z"
}
```

### 2. Mainframe Connectivity Test

Open browser to:
```
https://204.90.115.200:10443/zosmf/
```

You should see a certificate warning (normal for self-signed certificates), then a login page or JSON response.

### 3. Login Test

1. Navigate to http://localhost:5173
2. Enter TSO credentials:
   - **TSO ID**: Z##### (your 6-character ID)
   - **Password**: Your TSO password
3. Click "Connect to Mainframe"
4. Watch the 5-step progress indicator
5. Upon success, you'll be redirected to the workspace

### 4. Jira Integration Test

1. After successful login, you'll see the workspace
2. Enter a CSR/Issue ID (e.g., "PROJ-123")
3. Click "Retrieve from Jira"
4. View the structured XML output
5. Use "Approve" or "Request Changes" buttons

## 📁 Project Structure

```
OneTimer Bob/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/       # API controllers
│   │   ├── services/          # Business logic
│   │   │   ├── auth.service.ts
│   │   │   └── openai.service.ts
│   │   ├── integrations/      # External system integrations
│   │   │   ├── zosmf/        # Mainframe z/OSMF client
│   │   │   └── mcp/          # Jira MCP client
│   │   ├── utils/            # Utilities
│   │   └── server.ts         # Express server
│   ├── .env                  # Environment variables
│   └── package.json
│
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── Login.tsx
│   │   │   └── Workspace.tsx
│   │   ├── components/       # Reusable components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Utilities
│   │   └── App.tsx
│   ├── .env                  # Environment variables
│   └── package.json
│
├── docs/                      # Documentation
├── start-dev.bat             # Windows startup script
├── start-dev.sh              # Mac/Linux startup script
└── README.md                 # This file
```

## 🔧 Troubleshooting

### "Network Error" when logging in

**Cause:** Backend server is not running

**Solution:**
1. Check if backend terminal shows "Server listening on port 3000"
2. Verify http://localhost:3000/health works
3. Ensure backend started BEFORE frontend

### "Cannot connect to mainframe"

**Cause:** Network firewall blocking port 10443

**Solution:**
1. Test: https://204.90.115.200:10443/zosmf/
2. If timeout, contact network administrator
3. Try different network (VPN, mobile hotspot)

### "Invalid TSO credentials"

**Cause:** Wrong credentials or format

**Solution:**
1. Verify format: Z##### (6 characters total)
2. Check password is correct
3. Ensure credentials haven't expired

### Port already in use

**Windows:**
```powershell
# Kill process on port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Kill process on port 5173
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force
```

**Mac/Linux:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

For detailed troubleshooting, see:
- **NETWORK_ERROR_TROUBLESHOOTING.md** - Comprehensive network error guide
- **START_APPLICATION.md** - Detailed startup instructions

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 18.3.1
- TypeScript 5.6.2
- Vite 5.4.2
- Tailwind CSS 3.4.1
- Socket.IO Client 4.8.1
- Axios 1.7.9

**Backend:**
- Node.js + Express
- TypeScript
- Socket.IO 4.8.1
- Prisma ORM
- OpenAI SDK 4.67.3
- JWT Authentication

**Integrations:**
- IBM z/OSMF REST API (Mainframe)
- Jira via MCP (Model Context Protocol)
- OpenAI GPT-4o-mini

### Key Components

1. **Authentication Service** - Handles TSO login with 5-step progress tracking
2. **z/OSMF Client** - Mainframe integration for JCL submission and dataset operations
3. **OpenAI Service** - AI-powered analysis, XML generation, and task breakdown
4. **MCP Jira Client** - Retrieves and processes Jira issues
5. **WebSocket Server** - Real-time progress updates and notifications

## 📚 Documentation

- **ARCHITECTURE.md** - System architecture and design decisions
- **INTEGRATION_ANALYSIS.md** - Analysis of existing implementations
- **IMPLEMENTATION_STATUS.md** - Development progress tracking
- **OPENAI_INTEGRATION_GUIDE.md** - OpenAI setup and usage
- **FRONTEND_SETUP_GUIDE.md** - Frontend development guide
- **NETWORK_ERROR_TROUBLESHOOTING.md** - Network issue resolution
- **START_APPLICATION.md** - Detailed startup guide

## 🔐 Security

- JWT-based authentication with 24-hour expiration
- Encrypted credential storage
- HTTPS for mainframe communication
- Self-signed certificate handling
- Environment-based configuration
- No hardcoded credentials

## 🎯 Current Implementation Status

### ✅ Completed (Steps 1-2)

- [x] TSO mainframe authentication with progress feedback
- [x] 5-step visual progress indicator
- [x] WebSocket real-time updates
- [x] Login page with validation
- [x] Workspace routing after authentication
- [x] Jira CSR input component
- [x] XML rendering with syntax highlighting
- [x] Review & approval workflow
- [x] OpenAI integration for AI features
- [x] Copy/download XML functionality

### ⏳ Pending (Steps 3+)

- [ ] Complete Jira MCP integration
- [ ] Task generation and workflow engine
- [ ] Multi-turn conversation implementation
- [ ] Deliverables generation
- [ ] Full end-to-end testing

## 🚦 Getting Started Checklist

Before attempting to use the application:

- [ ] Node.js v18+ installed
- [ ] Backend dependencies installed (`cd backend && npm install`)
- [ ] Frontend dependencies installed (`cd frontend && npm install`)
- [ ] Backend `.env` file configured
- [ ] Frontend `.env` file configured
- [ ] Backend server running (port 3000)
- [ ] Frontend server running (port 5173)
- [ ] Mainframe accessible (https://204.90.115.200:10443/zosmf/)
- [ ] Valid TSO credentials available
- [ ] Jira credentials configured (for MCP)
- [ ] OpenAI API key configured

## 📞 Support

For issues or questions:

1. Check **NETWORK_ERROR_TROUBLESHOOTING.md**
2. Review backend terminal logs
3. Check browser console (F12)
4. Verify all prerequisites are met

When reporting issues, provide:
- Backend terminal output
- Frontend terminal output
- Browser console errors
- Network tab showing failed requests

## 📄 License

Enterprise Internal Use Only

## 🙏 Acknowledgments

- IBM z/OSMF REST API Documentation
- IBM BOB (inspiration for UI/UX)
- OpenAI GPT-4o-mini
- Jira MCP Server
- React and Vite communities

---

**Made with ❤️ by Bob**

**Version:** 1.0.0  
**Last Updated:** April 29, 2026"# OnetimerBob" 
