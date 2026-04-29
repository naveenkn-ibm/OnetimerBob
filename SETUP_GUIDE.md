# OneTimer Bob - Complete Setup Guide

This guide will walk you through setting up the OneTimer Bob application from scratch.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 20 LTS or higher installed
- [ ] npm 10 or higher installed
- [ ] Docker and Docker Compose installed
- [ ] Access to IBM Mainframe (z/OSMF at 204.90.115.200:10443)
- [ ] Valid TSO credentials (format: Z#####)
- [ ] Jira instance with API access
- [ ] Jira API token generated
- [ ] Git installed (for version control)

## 🚀 Step-by-Step Installation

### Step 1: Clone and Navigate to Project

```bash
cd "OneTimer Bob"
```

### Step 2: Install Root Dependencies

```bash
npm install
```

This installs the root-level dependencies including `concurrently` for running multiple services.

### Step 3: Install All Workspace Dependencies

```bash
npm run install:all
```

This command will:
- Install backend dependencies
- Install frontend dependencies
- Set up all required packages

**Expected output:**
```
✓ Root dependencies installed
✓ Frontend dependencies installed
✓ Backend dependencies installed
```

### Step 4: Environment Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` with your actual configuration:

```env
# Database
DATABASE_URL=postgresql://onetimer:onetimer123@localhost:5432/onetimer_db

# Redis
REDIS_URL=redis://localhost:6379

# Security (IMPORTANT: Generate secure keys!)
JWT_SECRET=<generate-a-secure-32-char-key>
ENCRYPTION_KEY=<generate-a-secure-32-char-key>

# Mainframe (from VSC1.pdf)
ZOSMF_HOST=204.90.115.200
ZOSMF_PORT=10443
ZOSMF_ACCOUNT=FB3
NODE_TLS_REJECT_UNAUTHORIZED=0

# Jira (Your credentials)
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token
```

**Generate secure keys:**
```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Step 5: Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready (about 10 seconds)
# Check status
docker-compose ps
```

#### Option B: Local Installation

If you prefer local PostgreSQL and Redis:

1. Install PostgreSQL 15+
2. Install Redis 7+
3. Create database:
```sql
CREATE DATABASE onetimer_db;
CREATE USER onetimer WITH PASSWORD 'onetimer123';
GRANT ALL PRIVILEGES ON DATABASE onetimer_db TO onetimer;
```

### Step 6: Prisma Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

**Expected output:**
```
✓ Prisma Client generated
✓ Migrations applied successfully
✓ Database schema created
```

### Step 7: Verify Mainframe Connectivity

Test if you can reach the mainframe:

```bash
# On Linux/Mac
curl -k https://204.90.115.200:10443/zosmf/services/authenticate

# On Windows (PowerShell)
Invoke-WebRequest -Uri https://204.90.115.200:10443/zosmf/services/authenticate -SkipCertificateCheck
```

**Expected:** You should see a response (even if it's an auth error - that's OK, it means the server is reachable)

**If you get timeout:** You need to request firewall access from your network team.

### Step 8: Setup MCP Jira Server

The application uses MCP (Model Context Protocol) to connect to Jira.

1. Ensure Docker/Podman is running
2. Pull the MCP Atlassian image:

```bash
# Using Docker
docker pull ghcr.io/github/github-mcp-server

# Using Podman
podman pull ghcr.io/github/github-mcp-server
```

3. Test MCP connection:

```bash
podman run -i --rm \
  -e JIRA_URL=https://your-company.atlassian.net \
  -e JIRA_USERNAME=your-email@company.com \
  -e JIRA_API_TOKEN=your-token \
  mcp-atlassian:latest
```

### Step 9: Start the Application

#### Development Mode (Recommended for testing)

```bash
# Start both frontend and backend
npm run dev
```

This will start:
- Backend API on http://localhost:5000
- Frontend on http://localhost:3000

**Expected output:**
```
[backend] Server running on port 5000
[backend] Database connected
[backend] Redis connected
[frontend] Compiled successfully!
[frontend] webpack compiled with 0 errors
```

#### Production Mode (Using Docker)

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d
```

### Step 10: Verify Installation

1. **Check Backend Health:**
```bash
curl http://localhost:5000/health
```

Expected: `{"status":"ok","timestamp":"..."}`

2. **Check Frontend:**
Open browser to http://localhost:3000

Expected: Login page with TSO ID and Password fields

3. **Check Database:**
```bash
npm run prisma:studio
```

Expected: Prisma Studio opens in browser showing database tables

## 🧪 Testing the Application

### Test 1: TSO Authentication

1. Open http://localhost:3000
2. Enter your TSO credentials:
   - TSO ID: Z##### (your actual TSO ID)
   - Password: (your TSO password)
3. Click "Login"

**Expected:**
- Progress bar shows authentication stages
- Messages like "Initializing connection...", "Authenticating...", etc.
- Successful login redirects to main workspace

**If it fails:**
- Check mainframe connectivity (Step 7)
- Verify TSO credentials are correct
- Check backend logs: `docker-compose logs backend`

### Test 2: Jira Integration

1. After successful login, you'll see the main workspace
2. In the chat input, enter a CSR/Issue ID: `CSR-123`
3. Press Enter

**Expected:**
- Chat shows "Connecting to Jira via MCP..."
- XML-formatted requirements appear in main panel
- Approval buttons appear

**If it fails:**
- Check Jira credentials in `.env`
- Verify MCP server is running
- Check backend logs for MCP errors

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Issue: "Redis connection failed"

**Solution:**
```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis
redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Issue: "Mainframe timeout"

**Solution:**
1. Verify network connectivity:
```bash
ping 204.90.115.200
```

2. Check if port 10443 is accessible:
```bash
telnet 204.90.115.200 10443
```

3. If blocked, contact network team for firewall rules

### Issue: "MCP Jira connection failed"

**Solution:**
1. Verify Jira credentials:
```bash
curl -u your-email@company.com:your-api-token \
  https://your-company.atlassian.net/rest/api/3/myself
```

2. Check if podman/docker is running:
```bash
podman --version
docker --version
```

3. Pull MCP image again:
```bash
podman pull mcp-atlassian:latest
```

### Issue: "Port already in use"

**Solution:**
```bash
# Find process using port 3000 or 5000
# On Linux/Mac
lsof -i :3000
lsof -i :5000

# On Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Kill the process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows
```

### Issue: TypeScript compilation errors

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules frontend/node_modules backend/node_modules
rm -rf frontend/dist backend/dist
npm run install:all

# Rebuild
npm run build
```

## 📊 Monitoring and Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Backend logs (local development)
tail -f backend/logs/app.log
tail -f backend/logs/error.log
```

### Database Management

```bash
# Open Prisma Studio
npm run prisma:studio

# Create new migration
cd backend
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

### Performance Monitoring

```bash
# Check Docker resource usage
docker stats

# Check Node.js memory usage
node --max-old-space-size=4096 backend/dist/server.js
```

## 🔒 Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (min 32 chars)
- [ ] Generate strong ENCRYPTION_KEY (min 32 chars)
- [ ] Enable HTTPS with valid certificates
- [ ] Set NODE_TLS_REJECT_UNAUTHORIZED=1 (if using valid certs)
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up log rotation
- [ ] Configure backup strategy
- [ ] Review CORS settings
- [ ] Enable audit logging
- [ ] Set up monitoring alerts

## 📚 Next Steps

After successful setup:

1. **Read the Architecture:** Review [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Test Workflows:** Try the healthcare claims processing workflow
3. **Customize:** Add your own JCL templates
4. **Integrate:** Connect additional systems as needed
5. **Monitor:** Set up Prometheus and Grafana for monitoring

## 🆘 Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review backend logs: `docker-compose logs backend`
3. Check database connectivity: `npm run prisma:studio`
4. Verify environment variables: `cat .env`
5. Test mainframe connectivity: `curl -k https://204.90.115.200:10443/zosmf/`

## ✅ Installation Complete!

If all steps completed successfully, you should have:

- ✅ Backend API running on port 5000
- ✅ Frontend UI running on port 3000
- ✅ PostgreSQL database initialized
- ✅ Redis cache running
- ✅ Mainframe connectivity verified
- ✅ Jira MCP integration configured

**You're ready to start using OneTimer Bob!**

Access the application at: http://localhost:3000

---

**Last Updated:** 2026-04-29
**Version:** 1.0.0