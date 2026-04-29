# OneTimer Bob - Complete Testing Guide

## Authentication Flow Testing (Steps 1-2)

### Prerequisites
1. **Backend Running**: `cd backend && npm run dev` (Port 3000)
2. **Frontend Running**: `cd frontend && npm run dev` (Port 5173)
3. **Test Credentials**: TSO ID: `Z86216` (or your assigned ID)

---

## Test Case 1: Complete Authentication Flow

### Expected Behavior
1. **Login Page Display**
   - Clean glass-morphism UI with IBM Z branding
   - TSO ID input field (uppercase validation)
   - Password input field with show/hide toggle
   - "Connect to Mainframe" button

2. **5-Step Progress Indicator**
   When user clicks "Connect to Mainframe":
   ```
   Step 1: Initializing connection to mainframe... (Yellow)
   Step 2: Establishing secure session... (Yellow)
   Step 3: Sending TSO credentials... (Yellow)
   Step 4: Validating user authentication... (Yellow)
   Step 5: Authentication complete! (Green)
   ```

3. **Success Dialog (2 seconds)**
   - Animated green checkmark icon with bounce
   - "Authentication Successful!" message
   - Shows TSO ID and session details
   - "Continue to Dashboard" button
   - **Auto-closes after 2 seconds** OR manual click

4. **Workspace Redirect**
   - After dialog closes, automatically routes to Workspace
   - Shows user info header with TSO ID
   - Displays CSR/Issue ID input for Jira integration

### Testing Steps

#### Step 1: Start Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

#### Step 2: Open Browser
Navigate to: `http://localhost:5173`

#### Step 3: Test Invalid Credentials
1. Enter TSO ID: `Z99999`
2. Enter Password: `wrongpass`
3. Click "Connect to Mainframe"
4. **Expected**: Error message "Invalid TSO credentials"
5. **Verify**: Progress bar shows error state (red)

#### Step 4: Test Valid Credentials
1. Enter TSO ID: `Z86216` (or your assigned ID)
2. Enter Password: (your actual password)
3. Click "Connect to Mainframe"
4. **Expected**: 
   - Progress bar shows all 5 steps sequentially
   - Each step turns green when completed
   - Success dialog appears with animation
   - Dialog shows for 2 seconds
   - Auto-redirects to Workspace

#### Step 5: Test Manual Dialog Close
1. Repeat Step 4
2. When success dialog appears, click "Continue to Dashboard" immediately
3. **Expected**: Dialog closes instantly, redirects to Workspace

#### Step 6: Verify Workspace Display
1. After redirect, verify:
   - User info header shows TSO ID
   - Session status shows "Active"
   - CSR/Issue ID input is visible
   - "Fetch Requirements" button is present

---

## Test Case 2: Browser Console Verification

### Open Browser DevTools (F12)

#### Expected Console Logs (Successful Login)
```
🔐 Attempting login with TSO ID: Z86216
🔌 Connecting to WebSocket...
✅ WebSocket connected
📊 Progress update: {"step":1,"message":"Initializing connection...","status":"in_progress"}
📊 Progress update: {"step":2,"message":"Establishing session...","status":"in_progress"}
📊 Progress update: {"step":3,"message":"Sending credentials...","status":"in_progress"}
📊 Progress update: {"step":4,"message":"Validating user...","status":"in_progress"}
📊 Progress update: {"step":5,"message":"Complete!","status":"completed"}
✅ Login successful
✅ Authentication complete, showing dialog...
⏰ Auto-closing dialog after 2 seconds...
```

#### Expected Network Requests
1. **POST** `/api/auth/login`
   - Status: 200 OK
   - Response: `{ success: true, token: "...", user: {...} }`

2. **WebSocket** `/socket.io/`
   - Status: 101 Switching Protocols
   - Messages: 5 progress updates

---

## Test Case 3: Error Handling

### Test 3.1: Invalid TSO ID Format
1. Enter TSO ID: `ABC123` (invalid format)
2. **Expected**: Validation error "TSO ID must start with 'Z' followed by 5 characters"

### Test 3.2: Empty Fields
1. Leave TSO ID empty
2. Click "Connect to Mainframe"
3. **Expected**: Validation error "Please enter your TSO ID"

### Test 3.3: Backend Connection Failure
1. Stop backend server
2. Try to login
3. **Expected**: Error message "Unable to connect to server"

### Test 3.4: Mainframe Timeout
1. Use valid credentials but simulate network delay
2. **Expected**: Progress indicator shows timeout after 30 seconds

---

## Test Case 4: UI/UX Verification

### Visual Elements Checklist
- [ ] Glass-morphism effect on login card
- [ ] Smooth animations on page load
- [ ] Password show/hide toggle works
- [ ] Progress bar animates smoothly
- [ ] Success dialog has bounce animation
- [ ] Green checkmark icon displays correctly
- [ ] "Continue to Dashboard" button is clickable
- [ ] Workspace header shows user info
- [ ] All text is readable (contrast check)
- [ ] Responsive design works on mobile

### Accessibility Checklist
- [ ] Tab navigation works through all inputs
- [ ] Enter key submits form
- [ ] Error messages are announced
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG standards

---

## Test Case 5: Session Management

### Test 5.1: Token Storage
1. Login successfully
2. Open DevTools → Application → Local Storage
3. **Verify**: `auth_token` is stored
4. **Verify**: Token is JWT format (3 parts separated by dots)

### Test 5.2: Authenticated State Persistence
1. Login successfully
2. Refresh page (F5)
3. **Expected**: Should remain on Workspace (not redirect to Login)

### Test 5.3: Logout (Future Feature)
1. Login successfully
2. Click logout button (when implemented)
3. **Expected**: Redirect to Login page, token cleared

---

## Test Case 6: Performance Testing

### Metrics to Verify
1. **Page Load Time**: < 2 seconds
2. **Authentication Time**: 3-5 seconds (depends on mainframe)
3. **Dialog Display Time**: Exactly 2 seconds
4. **Redirect Time**: < 500ms after dialog closes

### Performance Checklist
- [ ] No console errors or warnings
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] WebSocket connection is stable
- [ ] Progress updates are real-time (no lag)

---

## Test Case 7: Cross-Browser Testing

### Browsers to Test
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (latest, macOS only)

### Expected Behavior
All features should work identically across browsers.

---

## Test Case 8: Mobile Responsiveness

### Devices to Test
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (iPad/Android)

### Mobile-Specific Checks
- [ ] Login form is centered and readable
- [ ] Buttons are large enough to tap
- [ ] Progress bar is visible
- [ ] Success dialog fits screen
- [ ] No horizontal scrolling

---

## Known Issues & Limitations

### Current Scope (Steps 1-2 Only)
✅ **Implemented**:
- TSO authentication with mainframe
- 5-step progress indicator
- Success dialog with 2-second auto-redirect
- Workspace routing

⏳ **Not Yet Implemented** (Steps 3+):
- Jira CSR retrieval via MCP
- XML parsing and display
- AI-powered analysis
- Review & approval workflow
- Task generation engine

### Expected Errors (Normal Behavior)
1. **First-time connection**: May take 5-10 seconds due to SSL handshake
2. **Self-signed certificate warning**: Normal for mainframe (204.90.115.200)
3. **Session timeout**: After 24 hours, user must re-authenticate

---

## Troubleshooting

### Issue: "Cannot connect to backend"
**Solution**: Verify backend is running on port 3000
```bash
cd backend
npm run dev
```

### Issue: "Invalid TSO credentials"
**Solution**: 
1. Verify TSO ID format: `Z#####` (Z followed by 5 characters)
2. Check password is correct
3. Ensure mainframe is accessible: `https://204.90.115.200:10443/zosmf/`

### Issue: "WebSocket connection failed"
**Solution**: 
1. Check Vite proxy configuration in `frontend/vite.config.ts`
2. Verify backend WebSocket server is running
3. Check browser console for CORS errors

### Issue: "Success dialog doesn't show"
**Solution**:
1. Check browser console for React errors
2. Verify `AuthContext` is properly wrapped in `main.tsx`
3. Clear browser cache and reload

### Issue: "Redirect happens too fast"
**Solution**: This is now fixed! Dialog shows for 2 seconds before redirect.

---

## Success Criteria

### Steps 1-2 Complete When:
✅ User can authenticate with TSO credentials  
✅ 5-step progress indicator displays correctly  
✅ Success dialog shows for 2 seconds  
✅ Auto-redirect to Workspace works  
✅ Manual "Continue to Dashboard" button works  
✅ Workspace displays user info correctly  
✅ No console errors or warnings  
✅ All UI animations are smooth  
✅ Error handling works for invalid credentials  
✅ Session persists across page refreshes  

---

## Next Steps (After Testing)

Once Steps 1-2 are fully tested and verified:
1. **Report Results**: Document any issues found
2. **Request Step 3 Instructions**: Jira CSR retrieval implementation
3. **Prepare for MCP Integration**: Set up Jira credentials
4. **Plan XML Display**: Design main panel layout
5. **Design Approval Workflow**: Review & edit functionality

---

## Contact & Support

For issues or questions:
- Check `NETWORK_ERROR_TROUBLESHOOTING.md` for common problems
- Review `START_APPLICATION.md` for setup instructions
- Consult `README.md` for architecture details

---

**Last Updated**: 2026-04-29  
**Version**: 1.0.0 (Steps 1-2 Implementation)  
**Status**: ✅ Ready for Testing