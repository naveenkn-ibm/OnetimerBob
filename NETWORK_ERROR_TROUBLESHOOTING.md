# Network Error Troubleshooting Guide

## Issue: "Network Error" During Mainframe Connection

### Root Causes

The "network error" you're experiencing can be caused by several issues:

1. **Backend Server Not Running** (Most Common)
2. **Mainframe Connection Issues**
3. **CORS Configuration**
4. **Firewall/Network Restrictions**

---

## Solution Steps

### Step 1: Verify Backend Server is Running

**CRITICAL: The backend MUST be running before testing the frontend!**

```bash
# Terminal 1 - Start Backend Server
cd backend
npm install
npm run dev
```

**Expected Output:**
```
[INFO] OneTimer Bob backend starting...
[INFO] ZOSMFClient initialized { host: '204.90.115.200', port: 10443 }
[INFO] OpenAI service initialized successfully
[INFO] Server listening on port 3000
[INFO] Environment: development
```

**If you see errors:**
- Check if port 3000 is already in use
- Verify all dependencies are installed (`npm install`)
- Check `.env` file exists in backend directory

---

### Step 2: Start Frontend (After Backend is Running)

```bash
# Terminal 2 - Start Frontend
cd frontend
npm install
npm run dev
```

**Expected Output:**
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

### Step 3: Test Backend Health Check

Before attempting login, verify backend is accessible:

**Open browser and navigate to:**
```
http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "OneTimer Bob backend is running",
  "timestamp": "2026-04-29T07:15:00.000Z"
}
```

**If this fails:**
- Backend is not running
- Port 3000 is blocked
- Check backend terminal for errors

---

### Step 4: Test Mainframe Connectivity

The mainframe server must be accessible from your network.

**Test 1: Browser Test**
Open in browser:
```
https://204.90.115.200:10443/zosmf/
```

**Expected:** You should see a certificate warning (this is normal for self-signed certificates), then either:
- A login page
- A JSON response
- Or the page loads (even if it shows an error)

**If you get "Connection Timeout" or "Cannot reach this page":**
- Your network is blocking access to the mainframe
- You need to request firewall changes from your network administrator
- Try using a different network (VPN, mobile hotspot, etc.)

**Test 2: Command Line Test**
```bash
# Windows PowerShell
Test-NetConnection -ComputerName 204.90.115.200 -Port 10443

# Mac/Linux
nc -zv 204.90.115.200 10443
# or
telnet 204.90.115.200 10443
```

**Expected:** Connection should succeed

---

### Step 5: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try logging in
4. Look for error messages

**Common Errors:**

**Error: "Failed to fetch" or "Network Error"**
- Backend is not running
- Wrong API URL in frontend
- CORS issue

**Error: "Socket connection error"**
- Backend WebSocket not accessible
- Check backend is running on port 3000

**Error: "ECONNREFUSED"**
- Backend server is not running
- Wrong port configuration

---

## Detailed Error Analysis

### Error Type 1: Backend Not Running

**Symptoms:**
- Frontend shows "Network Error"
- Browser console shows: `GET http://localhost:3000/api/auth/login net::ERR_CONNECTION_REFUSED`
- No backend terminal output

**Solution:**
```bash
cd backend
npm run dev
```

---

### Error Type 2: Mainframe Unreachable

**Symptoms:**
- Backend is running
- Login attempt shows progress but fails at "Establishing session"
- Backend logs show: `ETIMEDOUT` or `ECONNREFUSED` to 204.90.115.200

**Solution:**
1. Test mainframe connectivity (see Step 4 above)
2. If blocked, request network firewall changes
3. Try different network connection

---

### Error Type 3: Invalid Credentials

**Symptoms:**
- Backend is running
- Mainframe is reachable
- Error: "Invalid TSO credentials" or "Authentication failed"

**Solution:**
1. Verify TSO ID format: `Z#####` (Z followed by 5 characters)
2. Check password is correct
3. Ensure credentials haven't expired

---

### Error Type 4: CORS Issues

**Symptoms:**
- Backend is running
- Browser console shows CORS error
- Error mentions "Access-Control-Allow-Origin"

**Solution:**
Check `backend/.env` has:
```env
CORS_ORIGIN=http://localhost:5173
```

And `backend/src/server.ts` has CORS configured:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
```

---

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] Backend server is running (`npm run dev` in backend directory)
- [ ] Backend health check works (http://localhost:3000/health)
- [ ] Frontend is running (`npm run dev` in frontend directory)
- [ ] Can access mainframe in browser (https://204.90.115.200:10443/zosmf/)
- [ ] TSO credentials are correct format (Z#####)
- [ ] No firewall blocking port 3000 or 5173
- [ ] Browser console shows no CORS errors

---

## Testing Sequence

**Correct Order:**

1. ✅ Start backend server first
2. ✅ Verify backend health check
3. ✅ Test mainframe connectivity
4. ✅ Start frontend
5. ✅ Open browser to http://localhost:5173
6. ✅ Attempt login

**Wrong Order:**

1. ❌ Start frontend first
2. ❌ Try to login
3. ❌ Get "Network Error"
4. ❌ Start backend (too late, frontend already tried)

---

## Environment Variables Check

### Backend `.env` File

Verify these settings in `backend/.env`:

```env
# Application
NODE_ENV=development
PORT=3000

# Mainframe Configuration
ZOSMF_HOST=204.90.115.200
ZOSMF_PORT=10443
ZOSMF_ACCOUNT=FB3
ZOSMF_PROTOCOL=https
NODE_TLS_REJECT_UNAUTHORIZED=0

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend `.env` File

Verify these settings in `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

---

## Advanced Debugging

### Enable Detailed Logging

In `backend/.env`, set:
```env
LOG_LEVEL=debug
```

This will show detailed connection attempts and errors.

### Check Network Connectivity

```bash
# Test if mainframe is reachable
curl -k https://204.90.115.200:10443/zosmf/services/info

# Expected: Some response (even if error)
# If timeout: Network is blocking connection
```

### Check Port Availability

```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5173

# Mac/Linux
lsof -i :3000
lsof -i :5173
```

If ports are in use, either:
- Kill the process using the port
- Change the port in configuration

---

## Still Having Issues?

If you've followed all steps and still getting errors, provide:

1. **Backend terminal output** (full logs)
2. **Frontend terminal output**
3. **Browser console errors** (F12 → Console tab)
4. **Network tab** (F12 → Network tab, filter by "login")
5. **Result of mainframe connectivity test** (Step 4)

This will help diagnose the exact issue.

---

## Common Success Indicators

When everything is working correctly, you should see:

**Backend Terminal:**
```
[INFO] Server listening on port 3000
[INFO] Client connected { socketId: 'abc123' }
[INFO] Login attempt started { tsoId: 'Z12345' }
[MAINFRAME] Authentication attempt Z12345
[MAINFRAME] Authentication successful Z12345
```

**Frontend:**
- Progress bar animates through 5 steps
- Each step shows status message
- Final step shows "Authentication successful"
- Redirects to workspace page

**Browser Console:**
- No red errors
- WebSocket connection established
- API calls return 200 status

---

## Quick Fix Commands

```bash
# Kill all node processes (if ports are stuck)
# Windows
taskkill /F /IM node.exe

# Mac/Linux
killall node

# Restart everything fresh
cd backend && npm run dev &
cd frontend && npm run dev
```

---

**Remember:** Always start the backend BEFORE the frontend!