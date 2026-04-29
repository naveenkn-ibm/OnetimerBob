# OneTimer Bob - Frontend Setup & Testing Guide

## 🎯 Overview

The frontend for OneTimer Bob has been successfully created with all required components for TSO authentication and Jira CSR retrieval. This guide will help you install dependencies and test the application.

---

## 📋 What Has Been Built

### ✅ Completed Components

1. **Login Page** ([`frontend/src/pages/Login.tsx`](frontend/src/pages/Login.tsx))
   - TSO ID input with format validation (Z#####)
   - Password input with show/hide toggle
   - Real-time 5-step progress indicator
   - Error handling and validation
   - Beautiful gradient background with animations

2. **Workspace Page** ([`frontend/src/pages/Workspace.tsx`](frontend/src/pages/Workspace.tsx))
   - CSR/Issue ID input field
   - Jira data fetching with progress tracking
   - Structured XML requirements display
   - Review & Approval workflow
   - Copy/Download XML functionality
   - User session display with logout

3. **Progress Bar Component** ([`frontend/src/components/ProgressBar.tsx`](frontend/src/components/ProgressBar.tsx))
   - Visual 5-step progress indicator
   - Animated transitions
   - Status icons (pending, in-progress, completed, error)
   - Step labels and messages

4. **Authentication Hook** ([`frontend/src/hooks/useAuth.ts`](frontend/src/hooks/useAuth.ts))
   - WebSocket-based real-time progress updates
   - Session management
   - Token storage and validation
   - Login/logout functionality

5. **API Client** ([`frontend/src/utils/api.ts`](frontend/src/utils/api.ts))
   - Axios-based HTTP client
   - Request/response interceptors
   - Token management
   - Error handling

6. **Configuration Files**
   - [`frontend/package.json`](frontend/package.json) - Dependencies
   - [`frontend/vite.config.ts`](frontend/vite.config.ts) - Vite configuration
   - [`frontend/tsconfig.json`](frontend/tsconfig.json) - TypeScript config
   - [`frontend/tailwind.config.js`](frontend/tailwind.config.js) - Tailwind CSS
   - [`frontend/.env`](frontend/.env) - Environment variables

---

## 🚀 Installation Steps

### Step 1: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages:
- React 18.3.1
- TypeScript 5.6.2
- Vite 6.0.11
- Tailwind CSS 3.4.17
- Socket.IO Client 4.8.1
- Axios 1.7.9
- Lucide React (icons)

### Step 3: Verify Environment Variables

Check that [`frontend/.env`](frontend/.env) contains:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_DEV_MODE=true
```

---

## 🧪 Testing the Frontend

### Option 1: Frontend Only (Mock Backend)

Start the development server:

```bash
npm run dev
```

The application will be available at: **http://localhost:5173**

**Note**: Without the backend running, you'll see connection errors. This is expected.

### Option 2: Full Stack Testing (Recommended)

1. **Start Backend** (in a separate terminal):
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**: http://localhost:5173

---

## 🎨 UI Features to Test

### Login Page
1. **TSO ID Validation**
   - Try entering invalid formats (should show error)
   - Valid format: Z##### (e.g., Z90035, ZQ1788)
   - Auto-converts to uppercase

2. **Password Field**
   - Click eye icon to show/hide password
   - Minimum 4 characters required

3. **Progress Indicator**
   - Watch 5-step authentication progress
   - Animated progress bar with shimmer effect
   - Step indicators change color (gray → blue → green)

4. **Error Handling**
   - Invalid credentials error display
   - Connection timeout handling
   - Clear error messages

### Workspace Page
1. **Header**
   - Displays TSO ID and session ID
   - Logout button functionality

2. **CSR Input**
   - Enter Jira issue key (e.g., PROJ-123)
   - Click "Fetch Details" or press Enter
   - Watch progress indicator

3. **Jira Data Display**
   - Issue metadata (key, type, status, priority)
   - Reporter and assignee information
   - Created/updated timestamps
   - Labels display

4. **XML Display**
   - Formatted XML in code block
   - Copy to clipboard button
   - Download XML file button

5. **Review & Approval**
   - "Approve Requirements" button
   - "Request Changes" button
   - Approval confirmation display

---

## 🐛 Expected TypeScript Errors

You'll see TypeScript errors in VSCode **before running `npm install`**. These are normal and will disappear after installation:

```
Cannot find module 'react'
Cannot find module 'socket.io-client'
JSX element implicitly has type 'any'
```

**Solution**: Run `npm install` in the frontend directory.

---

## 📁 File Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── ProgressBar.tsx          ✅ 5-step progress indicator
│   ├── hooks/
│   │   └── useAuth.ts               ✅ Authentication hook with WebSocket
│   ├── pages/
│   │   ├── Login.tsx                ✅ TSO authentication page
│   │   └── Workspace.tsx            ✅ Main workspace with Jira integration
│   ├── utils/
│   │   └── api.ts                   ✅ API client with interceptors
│   ├── App.tsx                      ✅ Main app component with routing
│   ├── main.tsx                     ✅ React entry point
│   ├── index.css                    ✅ Global styles with Tailwind
│   └── vite-env.d.ts                ✅ TypeScript declarations
├── public/                          📁 Static assets
├── index.html                       ✅ HTML template
├── package.json                     ✅ Dependencies
├── tsconfig.json                    ✅ TypeScript config
├── vite.config.ts                   ✅ Vite config with proxy
├── tailwind.config.js               ✅ Tailwind CSS config
├── postcss.config.js                ✅ PostCSS config
├── .env                             ✅ Environment variables
├── .env.example                     ✅ Environment template
└── README.md                        ✅ Frontend documentation
```

---

## 🎯 Testing Checklist

### Login Flow
- [ ] Enter valid TSO ID (Z#####)
- [ ] Enter password
- [ ] Click "Connect to Mainframe"
- [ ] Watch 5-step progress animation
- [ ] Verify successful authentication
- [ ] Check redirect to workspace

### Workspace Flow
- [ ] Verify user info in header
- [ ] Enter CSR/Issue ID
- [ ] Click "Fetch Details"
- [ ] Watch progress indicator
- [ ] Verify Jira data display
- [ ] Check XML formatting
- [ ] Test copy XML button
- [ ] Test download XML button
- [ ] Click "Approve Requirements"
- [ ] Verify approval confirmation
- [ ] Test logout button

### Error Scenarios
- [ ] Invalid TSO ID format
- [ ] Wrong password
- [ ] Invalid CSR ID
- [ ] Network errors
- [ ] Session expiration

---

## 🔧 Troubleshooting

### Issue: TypeScript Errors
**Solution**: Run `npm install` in the frontend directory

### Issue: Cannot Connect to Backend
**Solution**: 
1. Verify backend is running on port 3000
2. Check [`frontend/.env`](frontend/.env) has correct URLs
3. Check browser console for CORS errors

### Issue: WebSocket Connection Failed
**Solution**:
1. Ensure backend Socket.IO server is running
2. Check [`frontend/.env`](frontend/.env) VITE_WS_URL
3. Verify no firewall blocking WebSocket connections

### Issue: Styles Not Loading
**Solution**:
1. Run `npm install` to install Tailwind CSS
2. Restart dev server (`npm run dev`)
3. Clear browser cache

---

## 📊 Current Status

### ✅ Completed (100%)
- Frontend project structure
- All React components
- TypeScript configuration
- Tailwind CSS styling
- API integration layer
- WebSocket real-time updates
- Authentication flow
- Jira CSR retrieval UI
- Progress indicators
- Error handling
- Review & approval workflow

### ⏳ Pending (After Frontend Testing)
- Backend Jira MCP integration enhancement
- XML parsing and transformation
- Workflow generation engine
- Task orchestration system

---

## 🎉 Next Steps

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Test the Application**
   - Open http://localhost:5173
   - Test login flow
   - Test Jira CSR retrieval
   - Verify all UI components

4. **Provide Feedback**
   - Report any issues
   - Suggest improvements
   - Confirm functionality

5. **After Confirmation**
   - Backend enhancements will be implemented
   - Additional features will be added
   - Integration testing will be performed

---

## 📞 Support

If you encounter any issues during testing:
1. Check the browser console for errors
2. Verify all dependencies are installed
3. Ensure backend is running (if testing full stack)
4. Review this guide for troubleshooting steps

---

**Ready to test!** 🚀

Run `npm install` in the frontend directory and start the development server with `npm run dev`.