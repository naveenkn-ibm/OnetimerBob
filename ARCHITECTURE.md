# OneTimer Bob - Enterprise AI Application Architecture

## Executive Summary
An enterprise-grade AI-powered application replicating IBM BOB experience with mainframe TSO authentication, MCP-based Jira integration, multi-turn conversational AI, and real-time task orchestration for healthcare claims processing workflows.

## System Overview

### Core Capabilities
- **Mainframe Authentication**: Secure TSO login via z/OSMF REST API
- **MCP Integration**: Jira connectivity for CSR/Issue retrieval
- **Multi-turn AI**: Context-aware conversational interface
- **Task Orchestration**: Dynamic workflow generation and execution
- **Real-time Updates**: WebSocket-based progress tracking
- **Healthcare Claims Processing**: Automated JCL generation and execution

### Mainframe Configuration (from VSC1.pdf)
```yaml
Host: 204.90.115.200
Port: 10443
Protocol: HTTPS (z/OSMF REST API)
Account: FB3
TSO ID Format: Z##### (Z + 5 hex digits)
Certificate: Self-signed (rejectUnauthorized: false)
```

## Technology Stack

### Frontend Stack
- **Framework**: React 18.2+ with TypeScript 5.0+
- **UI Library**: Material-UI (MUI) v5.14+ for enterprise components
- **State Management**: Redux Toolkit 2.0+ with RTK Query
- **Real-time**: Socket.io-client 4.6+
- **HTTP Client**: Axios 1.6+ with interceptors
- **Routing**: React Router v6.20+
- **Forms**: React Hook Form 7.48+ with Zod 3.22+ validation
- **Styling**: Emotion (CSS-in-JS) + Tailwind CSS 3.4+
- **XML Rendering**: react-xml-viewer / custom XML parser
- **Code Editor**: Monaco Editor (for JCL editing)
- **Animations**: Framer Motion 10.16+

### Backend Stack
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4.18+ with TypeScript
- **API Architecture**: RESTful + WebSocket (Socket.io 4.6+)
- **Authentication**: JWT (jsonwebtoken 9.0+) + Passport.js 0.7+
- **Mainframe Connectivity**: 
  - `@zowe/cli` SDK 7.x for z/OSMF integration
  - `@zowe/imperative` for credential management
  - Custom z/OSMF REST API client
- **MCP Integration**: 
  - Custom MCP client for Jira (mcp-atlassian server)
  - MCP SDK for protocol handling
- **Database**: PostgreSQL 15+ (primary) + Redis 7+ (sessions/cache)
- **ORM**: Prisma 5.7+
- **Validation**: Zod 3.22+
- **Logging**: Winston 3.11+ + Morgan 1.10+
- **Process Management**: PM2 5.3+
- **Job Queue**: Bull 4.12+ (for async tasks)

### Security Layer
- **Encryption**: 
  - bcrypt 5.1+ (password hashing)
  - crypto (AES-256-GCM for sensitive data)
- **Secrets Management**: 
  - dotenv-vault / AWS Secrets Manager
  - Encrypted credential storage
- **HTTPS**: TLS 1.3 with self-signed cert handling
- **CORS**: Configured with whitelist
- **Rate Limiting**: express-rate-limit 7.1+
- **Security Headers**: Helmet.js 7.1+
- **Input Sanitization**: express-validator 7.0+

### DevOps & Infrastructure
- **Containerization**: Docker 24+ with Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston (structured JSON logs)
- **API Documentation**: Swagger/OpenAPI 3.0
- **Testing**: Jest 29+ + Supertest 6+ + React Testing Library

## Architecture Layers

### 1. Presentation Layer (Frontend)

#### Component Structure
```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx          # TSO authentication UI
│   │   ├── ProgressIndicator.tsx  # Multi-stage progress bar
│   │   └── AuthGuard.tsx          # Route protection
│   ├── workspace/
│   │   ├── MainWorkspace.tsx      # IBM BOB-style dashboard
│   │   ├── TaskPanel.tsx          # Left: Task workflow list
│   │   ├── OutputPanel.tsx        # Center: Deliverables view
│   │   ├── ChatPanel.tsx          # Right/Bottom: Chat interface
│   │   └── XMLViewer.tsx          # XML rendering with expand/collapse
│   ├── workflow/
│   │   ├── TaskList.tsx           # Dynamic task generation
│   │   ├── TaskItem.tsx           # Individual task with status
│   │   ├── ApprovalControls.tsx  # Approve/Reject buttons
│   │   └── JCLEditor.tsx          # Monaco-based JCL editor
│   └── common/
│       ├── StatusIndicator.tsx    # 🟡🟢🔵 status badges
│       ├── ProgressBar.tsx        # Animated progress
│       └── ErrorBoundary.tsx      # Error handling
├── features/
│   ├── auth/                      # Auth slice (Redux)
│   ├── workspace/                 # Workspace slice
│   ├── jira/                      # Jira integration slice
│   └── mainframe/                 # Mainframe operations slice
├── services/
│   ├── api.ts                     # Axios instance
│   ├── socket.ts                  # Socket.io client
│   ├── auth.service.ts            # Auth API calls
│   ├── jira.service.ts            # Jira MCP calls
│   └── mainframe.service.ts       # z/OSMF API calls
├── hooks/
│   ├── useAuth.ts                 # Authentication hook
│   ├── useWebSocket.ts            # Real-time updates
│   └── useMultiTurn.ts            # Conversation context
├── types/
│   ├── auth.types.ts
│   ├── jira.types.ts
│   └── mainframe.types.ts
└── utils/
    ├── xmlParser.ts               # XML parsing utilities
    ├── jclFormatter.ts            # JCL syntax highlighting
    └── encryption.ts              # Client-side encryption
```

#### UI Layout (IBM BOB-inspired)
```
┌─────────────────────────────────────────────────────────────┐
│  OneTimer Bob                    [User: Z#####] [Logout]    │
├──────────────┬──────────────────────────────┬───────────────┤
│              │                              │               │
│  Task Panel  │     Output/Deliverables     │  Chat Panel   │
│  (Left 25%)  │        (Center 50%)          │  (Right 25%)  │
│              │                              │               │
│  ☐ Task 1    │  ┌────────────────────────┐ │  💬 System:   │
│  🟡 Task 2   │  │  XML Viewer / JCL      │ │  Connecting   │
│  🟢 Task 3   │  │  Editor / Reports      │ │  to Jira...   │
│  ☐ Task 4    │  │                        │ │               │
│              │  │  [Approve] [Reject]    │ │  👤 User:     │
│  [Edit]      │  └────────────────────────┘ │  Get CSR-123  │
│  [Regenerate]│                              │               │
│              │                              │  [Send]       │
└──────────────┴──────────────────────────────┴───────────────┘
```

### 2. Application Layer (Backend)

#### Service Architecture
```
src/
├── controllers/
│   ├── auth.controller.ts         # Authentication endpoints
│   ├── jira.controller.ts         # Jira MCP integration
│   ├── mainframe.controller.ts    # z/OSMF operations
│   └── workflow.controller.ts     # Task orchestration
├── services/
│   ├── auth.service.ts            # JWT + session management
│   ├── mainframe.service.ts       # z/OSMF client wrapper
│   ├── jira.service.ts            # MCP Jira client
│   ├── workflow.service.ts        # Task generation engine
│   ├── jcl.service.ts             # JCL template processing
│   └── ai.service.ts              # Multi-turn conversation logic
├── middleware/
│   ├── auth.middleware.ts         # JWT verification
│   ├── validation.middleware.ts   # Request validation
│   ├── error.middleware.ts        # Error handling
│   └── rate-limit.middleware.ts   # Rate limiting
├── models/
│   ├── user.model.ts              # User entity
│   ├── session.model.ts           # Session management
│   ├── task.model.ts              # Task tracking
│   ├── conversation.model.ts      # Chat history
│   └── workflow.model.ts          # Workflow state
├── integrations/
│   ├── zosmf/
│   │   ├── client.ts              # z/OSMF REST client
│   │   ├── auth.ts                # TSO authentication
│   │   ├── jobs.ts                # JCL submission
│   │   └── datasets.ts            # Dataset operations
│   └── mcp/
│       ├── jira-client.ts         # MCP Jira integration
│       └── protocol.ts            # MCP protocol handler
├── utils/
│   ├── encryption.ts              # AES-256 encryption
│   ├── logger.ts                  # Winston logger
│   ├── validator.ts               # Zod schemas
│   └── xml-parser.ts              # XML processing
├── config/
│   ├── database.ts                # Prisma config
│   ├── redis.ts                   # Redis config
│   └── mainframe.ts               # z/OSMF config
└── websocket/
    ├── socket.handler.ts          # Socket.io events
    └── progress.emitter.ts        # Progress updates
```

#### API Endpoints

**Authentication**
```
POST   /api/auth/login              # TSO authentication
POST   /api/auth/logout             # Session termination
GET    /api/auth/session            # Session validation
POST   /api/auth/refresh            # Token refresh
```

**Jira Integration (MCP)**
```
POST   /api/jira/fetch-issue        # Fetch CSR/Issue via MCP
GET    /api/jira/issue/:id          # Get issue details
POST   /api/jira/update-comment     # Update Jira comments
```

**Mainframe Operations**
```
POST   /api/mainframe/submit-jcl    # Submit JCL job
GET    /api/mainframe/job/:id       # Get job status
GET    /api/mainframe/job/:id/log   # Get job output
GET    /api/mainframe/datasets      # List datasets
```

**Workflow Management**
```
POST   /api/workflow/create         # Generate workflow
GET    /api/workflow/:id            # Get workflow state
PUT    /api/workflow/:id/task       # Update task status
POST   /api/workflow/:id/approve    # Approve workflow step
```

**WebSocket Events**
```
connect                             # Client connection
authenticate                        # Socket authentication
progress:update                     # Progress notifications
task:status                         # Task status changes
chat:message                        # Chat messages
error                               # Error notifications
```

### 3. Data Layer

#### Database Schema (PostgreSQL + Prisma)

```prisma
// schema.prisma

model User {
  id            String   @id @default(uuid())
  tsoId         String   @unique
  encryptedCreds String  // Encrypted TSO password
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  sessions      Session[]
  workflows     Workflow[]
  conversations Conversation[]
}

model Session {
  id            String   @id @default(uuid())
  userId        String
  token         String   @unique
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  
  user          User     @relation(fields: [userId], references: [id])
}

model Workflow {
  id            String   @id @default(uuid())
  userId        String
  csrId         String
  status        String   // pending, in_progress, completed, failed
  jiraData      Json     // Structured Jira issue data
  approvalState String   // pending_review, approved, rejected
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user          User     @relation(fields: [userId], references: [id])
  tasks         Task[]
  conversations Conversation[]
}

model Task {
  id            String   @id @default(uuid())
  workflowId    String
  sequence      Int
  title         String
  description   String?
  status        String   // pending, in_progress, completed, failed
  type          String   // jcl_generation, jcl_submission, approval, etc.
  metadata      Json?    // Task-specific data
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  workflow      Workflow @relation(fields: [workflowId], references: [id])
}

model Conversation {
  id            String   @id @default(uuid())
  workflowId    String
  userId        String
  role          String   // user, system, assistant
  message       String
  metadata      Json?
  createdAt     DateTime @default(now())
  
  workflow      Workflow @relation(fields: [workflowId], references: [id])
  user          User     @relation(fields: [userId], references: [id])
}

model JCLTemplate {
  id            String   @id @default(uuid())
  name          String   @unique
  description   String?
  template      String   // JCL template content
  variables     Json     // Template variables
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

#### Redis Cache Structure
```
sessions:{sessionId}              # Session data (TTL: 24h)
user:{tsoId}:credentials          # Encrypted credentials (TTL: 1h)
workflow:{workflowId}:state       # Workflow state cache
jira:issue:{issueId}              # Cached Jira data (TTL: 15m)
mainframe:job:{jobId}:status      # Job status cache (TTL: 5m)
```

### 4. Integration Layer

#### z/OSMF Integration (Mainframe)

**Authentication Flow**
```typescript
// Mainframe authentication using z/OSMF REST API
1. POST https://204.90.115.200:10443/zosmf/services/authenticate
   Headers: {
     Authorization: Basic base64(tsoId:password)
     X-CSRF-ZOSMF-HEADER: true
   }
   
2. Receive LTPA token + session cookie

3. Store encrypted credentials in Redis

4. Use token for subsequent API calls
```

**JCL Submission**
```typescript
// Submit JCL job
POST /zosmf/restjobs/jobs
Content-Type: text/plain
Body: <JCL content>

// Check job status
GET /zosmf/restjobs/jobs/{jobname}/{jobid}

// Get job output
GET /zosmf/restjobs/jobs/{jobname}/{jobid}/files/{fileid}/records
```

#### MCP Jira Integration

**MCP Client Configuration**
```typescript
// Connect to mcp-atlassian server
const mcpClient = new MCPClient({
  serverName: 'mcp-atlassian',
  transport: 'stdio',
  command: 'podman',
  args: [
    'run', '-i', '--rm',
    '-e', 'JIRA_URL',
    '-e', 'JIRA_USERNAME',
    '-e', 'JIRA_API_TOKEN',
    'mcp-atlassian:latest'
  ]
});

// Fetch issue via MCP
const issue = await mcpClient.callTool('jira_get_issue', {
  issue_key: 'CSR-123',
  fields: 'summary,description,status,customfield_*'
});
```

**XML Transformation**
```typescript
// Transform Jira JSON to structured XML
{
  "issue": {
    "key": "CSR-123",
    "fields": {
      "summary": "Delete pending claim",
      "customfield_10001": "Claim ID: 12345",
      "customfield_10002": "Region: PROD"
    }
  }
}

↓ Transform ↓

<requirement>
  <csr>CSR-123</csr>
  <summary>Delete pending claim</summary>
  <claim>
    <id>12345</id>
    <region>PROD</region>
  </claim>
</requirement>
```

### 5. Security Architecture

#### Authentication Flow
```
1. User enters TSO ID + Password
2. Frontend encrypts password (client-side)
3. Backend validates credentials with z/OSMF
4. Generate JWT token (exp: 24h)
5. Store session in Redis
6. Return token + user data
7. Frontend stores token in httpOnly cookie
```

#### Credential Management
```typescript
// Encryption at rest
const encryptCredentials = (password: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};
```

#### Security Headers (Helmet.js)
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https://204.90.115.200:10443"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 6. Workflow Engine

#### Task Generation Logic
```typescript
// Dynamic task generation based on CSR type
const generateWorkflow = (csrData: JiraIssue): Task[] => {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Fetch Jira Requirements',
      status: 'completed',
      type: 'jira_fetch'
    },
    {
      id: '2',
      title: 'Generate Unit Test JCL',
      status: 'pending',
      type: 'jcl_generation',
      template: 'unit_test_template'
    },
    {
      id: '3',
      title: 'SME Review & Approval',
      status: 'pending',
      type: 'approval',
      requiresHumanInput: true
    },
    {
      id: '4',
      title: 'Submit JCL to Mainframe',
      status: 'pending',
      type: 'jcl_submission'
    },
    {
      id: '5',
      title: 'Monitor Job Execution',
      status: 'pending',
      type: 'job_monitoring'
    }
  ];
  
  return tasks;
};
```

#### Multi-turn Conversation Context
```typescript
// Maintain conversation context
interface ConversationContext {
  workflowId: string;
  currentStep: number;
  history: Message[];
  state: {
    csrData?: JiraIssue;
    generatedJCL?: string;
    jobResults?: JobOutput;
    approvals: Record<string, boolean>;
  };
}

// Context-aware response generation
const handleUserMessage = async (
  message: string,
  context: ConversationContext
): Promise<Response> => {
  // Analyze intent
  const intent = analyzeIntent(message, context);
  
  // Execute appropriate action
  switch (intent.type) {
    case 'fetch_csr':
      return await fetchJiraIssue(intent.csrId);
    case 'approve':
      return await approveCurrentStep(context);
    case 'edit_jcl':
      return await updateJCL(intent.changes, context);
    case 'regenerate':
      return await regenerateOutput(context);
  }
};
```

## Deployment Architecture

### Docker Compose Setup
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:5000
      - REACT_APP_WS_URL=ws://backend:5000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/onetimer
      - REDIS_URL=redis://redis:6379
      - ZOSMF_HOST=204.90.115.200
      - ZOSMF_PORT=10443
      - NODE_TLS_REJECT_UNAUTHORIZED=0
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=onetimer
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Performance Optimization

### Frontend
- Code splitting with React.lazy()
- Memoization with React.memo() and useMemo()
- Virtual scrolling for large task lists
- Debounced search and input
- Service Worker for offline capability

### Backend
- Connection pooling (PostgreSQL + Redis)
- Response caching with Redis
- Async job processing with Bull queues
- Rate limiting per user
- Compression middleware (gzip)

### Database
- Indexed columns: userId, workflowId, csrId, status
- Materialized views for complex queries
- Query optimization with EXPLAIN ANALYZE
- Connection pooling (max 20 connections)

## Monitoring & Logging

### Structured Logging (Winston)
```typescript
logger.info('JCL submitted', {
  userId: 'Z12345',
  workflowId: 'wf-123',
  jobName: 'UNITTEST',
  timestamp: new Date().toISOString()
});
```

### Metrics (Prometheus)
- API response times
- Database query duration
- WebSocket connections
- Job submission success rate
- Error rates by endpoint

## Testing Strategy

### Unit Tests (Jest)
- Service layer logic
- Utility functions
- Validation schemas
- 80%+ code coverage target

### Integration Tests
- API endpoint testing (Supertest)
- Database operations
- MCP integration
- z/OSMF connectivity

### E2E Tests (Playwright)
- Complete authentication flow
- Workflow execution
- Approval process
- Error handling

## Security Compliance

### Data Protection
- Credentials encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- No logging of sensitive data
- Automatic session expiration

### Access Control
- Role-based access control (RBAC)
- JWT-based authentication
- Session management with Redis
- Rate limiting per user

### Audit Trail
- All actions logged with user ID
- Workflow state changes tracked
- Approval events recorded
- Compliance-ready audit logs

## Scalability Considerations

### Horizontal Scaling
- Stateless backend services
- Session storage in Redis
- Load balancer ready
- Database read replicas

### Vertical Scaling
- Optimized database queries
- Efficient caching strategy
- Async processing for heavy tasks
- Resource monitoring

## Future Enhancements

1. **AI-Powered Features**
   - Natural language JCL generation
   - Intelligent error diagnosis
   - Predictive workflow optimization

2. **Additional Integrations**
   - ServiceNow integration
   - Slack notifications
   - Email alerts
   - GitHub integration

3. **Advanced Features**
   - Workflow templates library
   - Batch processing
   - Scheduled jobs
   - Analytics dashboard

## Conclusion

This architecture provides a solid foundation for an enterprise-grade application that replicates IBM BOB's capabilities while maintaining security, scalability, and maintainability. The modular design allows for easy extension and integration with additional systems as requirements evolve.