# Quick Start Guide - OneTimer Bob

## 🚀 Starting the Application

### Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js installed (v18 or higher)
- ✅ npm installed
- ✅ Git Bash or PowerShell (Windows) / Terminal (Mac/Linux)

---

## Step-by-Step Startup

### Step 1: Open Two Terminal Windows

You need **TWO separate terminal windows**:
- Terminal 1: For Backend Server
- Terminal 2: For Frontend Application

---

### Step 2: Start Backend Server (Terminal 1)

```bash
# Navigate to backend directory
cd backend

# Install dependencies (first time only)
npm install

# Start the backend server
npm run dev
```

**Wait for this message:**
```
[INFO] Server listening on port 3000
[INFO] ZOSMFClient initialized
[INFO] OpenAI service initialized successfully
```

**✅ Backend is ready when you see these messages!**

**⚠️ DO NOT CLOSE THIS TERMINAL - Keep it running!**

---

### Step 3: Start Frontend Application (Terminal 2)

**IMPORTANT: Only start frontend AFTER backend is running!**

```bash
# Navigate to frontend directory (in a NEW terminal)
cd frontend

# Install dependencies (first time only)
npm install

# Start the frontend
npm run dev
```

**Wait for this message:**
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
```

**✅ Frontend is ready!**

---

### Step 4: Open Browser

Open your web browser and navigate to:
```
http://localhost:5173
```

You should see the OneTimer Bob login page!

---

## 🧪 Testing the Application

### Test 1: Backend Health Check

Before logging in, verify backend is working:

**Open in browser:**
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

✅ If you see this, backend is working correctly!

---

### Test 2: Mainframe Connectivity

**Open in browser:**
```
https://204.90.115.200:10443/zosmf/
```

**Expected:** 
- Certificate warning (click "Advanced" → "Proceed")
- Login page or JSON response

✅ If page loads (even with errors), mainframe is reachable!

❌ If timeout or "cannot reach", your network is blocking the connection.

---

### Test 3: Login to Application

1. Go to http://localhost:5173
2. Enter your TSO credentials:
   - **TSO ID**: Z##### (your 6-character ID)
   - **Password**: Your TSO password
3. Click "Connect to Mainframe"

**Expected Behavior:**
- Progress bar appears with 5 steps
- Each step shows status message:
  1. "Initializing connection to mainframe..."
  2. "Establishing session with z/OSMF..."
  3. "Sending credentials securely..."
  4. "Validating user credentials..."
  5. "Authentication successful!"
- Redirects to workspace page

✅ Success! You're now in the main workspace!

---

## 🛑 Stopping the Application

### To Stop:

**Terminal 1 (Backend):**
```
Press Ctrl+C
```

**Terminal 2 (Frontend):**
```
Press Ctrl+C
```

---

## 🔧 Troubleshooting

### Problem: "Network Error" when logging in

**Solution:**
1. Check if backend is running (Terminal 1 should show logs)
2. Verify http://localhost:3000/health works
3. Make sure you started backend BEFORE frontend

---

### Problem: Backend won't start

**Error: "Port 3000 already in use"**

**Solution:**
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

Then try starting backend again.

---

### Problem: Frontend won't start

**Error: "Port 5173 already in use"**

**Solution:**
```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force

# Mac/Linux
lsof -ti:5173 | xargs kill -9
```

Then try starting frontend again.

---

### Problem: "Cannot connect to mainframe"

**Possible Causes:**
1. Network firewall blocking port 10443
2. VPN required
3. Mainframe server down

**Solution:**
1. Test mainframe connectivity (see Test 2 above)
2. Contact network administrator if blocked
3. Try different network (mobile hotspot, VPN, etc.)

---

### Problem: "Invalid TSO credentials"

**Solution:**
1. Verify TSO ID format: Z##### (6 characters total)
2. Check password is correct
3. Ensure credentials haven't expired
4. Try logging in via browser first: https://204.90.115.200:10443/zosmf/

---

## 📋 Quick Reference

### Backend Commands
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Run production build
```

### Frontend Commands
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Important URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Backend Health: http://localhost:3000/health
- Mainframe: https://204.90.115.200:10443/zosmf/

---

## 🎯 Success Checklist

Before attempting login, verify:

- [ ] Backend terminal shows "Server listening on port 3000"
- [ ] Frontend terminal shows "Local: http://localhost:5173/"
- [ ] http://localhost:3000/health returns JSON response
- [ ] https://204.90.115.200:10443/zosmf/ loads in browser
- [ ] You have valid TSO credentials (Z##### format)
- [ ] Both terminals are still running (not closed)

If all checked, you're ready to login! ✅

---

## 💡 Pro Tips

1. **Keep terminals visible** - You can see real-time logs
2. **Backend first, always** - Never start frontend before backend
3. **Check health endpoint** - Quick way to verify backend is working
4. **Watch the logs** - Backend terminal shows authentication progress
5. **Browser DevTools** - Press F12 to see detailed error messages

---

## 🆘 Still Having Issues?

If you're still experiencing problems, check:

1. **NETWORK_ERROR_TROUBLESHOOTING.md** - Comprehensive troubleshooting guide
2. **Backend terminal logs** - Look for error messages
3. **Browser console** (F12) - Check for JavaScript errors
4. **Network tab** (F12) - See which API calls are failing

---

## 📞 Getting Help

When reporting issues, provide:

1. Backend terminal output (copy all text)
2. Frontend terminal output
3. Browser console errors (F12 → Console)
4. Network tab showing failed requests (F12 → Network)
5. Result of mainframe connectivity test

This helps diagnose the exact problem quickly!

---

**Remember: Backend → Frontend → Browser → Login**

That's the correct order! 🎉