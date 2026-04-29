# OneTimer Bob - Frontend

React + TypeScript + Vite frontend for the OneTimer Bob AI-powered healthcare claims processing application.

## Features

- **TSO Authentication**: Secure mainframe authentication with real-time progress feedback
- **Jira Integration**: Fetch and display CSR/Issue details via MCP
- **Real-time Updates**: WebSocket-based progress tracking
- **Modern UI**: Tailwind CSS with glass morphism effects
- **Type Safety**: Full TypeScript support

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── ProgressBar.tsx
│   ├── hooks/           # Custom React hooks
│   │   └── useAuth.ts
│   ├── pages/           # Page components
│   │   ├── Login.tsx
│   │   └── Workspace.tsx
│   ├── utils/           # Utility functions
│   │   └── api.ts
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   ├── index.css        # Global styles
│   └── vite-env.d.ts    # TypeScript declarations
├── public/              # Static assets
├── index.html           # HTML template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── tailwind.config.js   # Tailwind CSS config
```

## Key Components

### Login Page
- TSO ID and password input
- Real-time authentication progress (5 steps)
- Error handling and validation
- Secure credential handling

### Workspace Page
- CSR/Issue ID input
- Jira data fetching with progress tracking
- XML requirements display
- Review and approval workflow
- Copy/download XML functionality

### Progress Bar Component
- Visual progress indicator
- Step-by-step status updates
- Animated transitions
- Error state handling

### useAuth Hook
- Authentication state management
- WebSocket connection for real-time updates
- Session validation
- Token management

## API Integration

The frontend communicates with the backend via:
- REST API endpoints (`/api/*`)
- WebSocket connection for real-time progress updates

### API Endpoints Used:
- `POST /api/auth/login` - TSO authentication
- `POST /api/auth/logout` - Logout
- `GET /api/auth/validate` - Session validation
- `POST /api/jira/issue` - Fetch Jira issue details

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **Custom Animations**: Progress indicators, loading states
- **Glass Morphism**: Modern UI effects
- **Dark Theme**: Optimized for enterprise use

## TypeScript Errors

The TypeScript errors you see are expected during initial setup. They will be resolved once you:
1. Install dependencies: `npm install`
2. The TypeScript compiler will recognize all imported modules

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000/api` |
| `VITE_WS_URL` | WebSocket server URL | `http://localhost:3000` |
| `VITE_DEV_MODE` | Enable development mode | `true` |

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Next Steps

After frontend is tested and confirmed:
1. Backend enhancements for Jira MCP integration
2. XML parsing and transformation
3. Workflow generation engine
4. Task orchestration system

## Notes

- The frontend is designed to work with the backend server running on port 3000
- WebSocket connection is required for real-time progress updates
- All API calls include authentication tokens via localStorage
- Session tokens expire after 24 hours