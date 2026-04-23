# TypeScript Backend — Patterns Used in This Project

## Why TypeScript on the Backend

JavaScript is dynamic — you can pass anything anywhere, and bugs only surface at runtime. TypeScript adds a static type layer that catches mistakes before you run the code.

Key benefits for backend work:
- API response shapes are documented and enforced
- Refactoring is safe — TypeScript tells you everything that breaks
- IDE autocomplete everywhere
- Shared types between frontend and backend (no divergence)

---

## How TypeScript Works

TypeScript is a **superset of JavaScript**. All valid JS is valid TS. You add types on top.

```typescript
// JavaScript
function createDeployment(gitUrl) {
  // gitUrl could be anything — number, null, object
}

// TypeScript
function createDeployment(gitUrl: string): Promise<Deployment> {
  // gitUrl must be string, return must be Promise<Deployment>
}
```

TypeScript compiles to plain JavaScript. The types are **erased at runtime** — they only exist at compile time for checking.

```bash
# Compile once
npx tsc

# Compile and watch
npx tsc --watch

# Run TypeScript directly (no compile step — for dev)
npx tsx src/index.ts
```

---

## Project Setup

```bash
npm init -y
npm install express
npm install -D typescript @types/node @types/express tsx
npx tsc --init
```

`tsconfig.json` — key options:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,           // catches most bugs
    "esModuleInterop": true
  }
}
```

---

## Defining Types

### Interfaces vs Types

Both define shapes. Use `interface` for object shapes, `type` for unions and aliases.

```typescript
// Object shape — use interface
interface Deployment {
  id: string
  gitUrl: string
  status: DeploymentStatus
  port?: number       // optional with ?
  createdAt: Date
  url?: string
}

// Union — use type
type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'running' | 'failed'
```

### Generics

Reusable types that work with different shapes:

```typescript
interface ApiResponse<T> {
  data: T
  error?: string
  timestamp: number
}

// Usage
const response: ApiResponse<Deployment> = { ... }
const listResponse: ApiResponse<Deployment[]> = { ... }
```

---

## Express with TypeScript

```typescript
import express, { Request, Response } from 'express'

const app = express()
app.use(express.json())

// Typed route handler
app.post('/deployments', async (req: Request, res: Response) => {
  const { gitUrl } = req.body as { gitUrl: string }
  
  const deployment = await deploymentService.create(gitUrl)
  res.status(201).json(deployment)
})

// Custom typed request
interface CreateDeploymentBody {
  gitUrl: string
  branch?: string
}

app.post('/deployments', async (
  req: Request<{}, {}, CreateDeploymentBody>,
  res: Response<ApiResponse<Deployment>>
) => {
  const { gitUrl, branch = 'main' } = req.body
  // req.body is fully typed
})
```

---

## Async/Await and Error Handling

```typescript
// Always use async/await, never .then()
// Always wrap in try/catch

app.post('/deployments', async (req: Request, res: Response) => {
  try {
    const deployment = await createDeployment(req.body.gitUrl)
    res.status(201).json(deployment)
  } catch (err) {
    // err is unknown in TypeScript — you must narrow it
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})
```

### Central Error Handler

```typescript
// Type for Express error handler
import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err)
  res.status(err.status ?? 500).json({
    error: err.message ?? 'Internal server error'
  })
}

app.use(errorHandler)  // must be registered AFTER all routes
```

---

## The Deployment Service

This is the core of our backend — orchestrates Railpack, Docker, and Caddy.

```typescript
import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import Docker from 'dockerode'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

// Active builds: deploymentId → EventEmitter
const activeBuilds = new Map<string, EventEmitter>()

async function createDeployment(gitUrl: string): Promise<Deployment> {
  const id = generateId()
  const deployment: Deployment = {
    id,
    gitUrl,
    status: 'pending',
    createdAt: new Date(),
  }
  
  // Save to store
  store.set(id, deployment)
  
  // Kick off build in background — don't await, return immediately
  runPipeline(deployment).catch(err => {
    updateStatus(id, 'failed')
    console.error('Pipeline failed:', err)
  })
  
  return deployment
}

async function runPipeline(deployment: Deployment) {
  const emitter = new EventEmitter()
  activeBuilds.set(deployment.id, emitter)
  
  try {
    // Phase 1: Clone
    updateStatus(deployment.id, 'building')
    await cloneRepo(deployment.gitUrl, deployment.id, emitter)
    
    // Phase 2: Build with Railpack
    const imageName = `deploy-${deployment.id}`
    await buildImage(deployment.id, imageName, emitter)
    
    // Phase 3: Run container
    updateStatus(deployment.id, 'deploying')
    const port = await runContainer(imageName, emitter)
    
    // Phase 4: Register with Caddy
    await registerWithCaddy(deployment.id, port)
    
    updateStatus(deployment.id, 'running')
    emitter.emit('done')
    
  } catch (err) {
    emitter.emit('log', `Error: ${err}`)
    emitter.emit('done')
    throw err
  } finally {
    activeBuilds.delete(deployment.id)
  }
}
```

---

## Child Processes (Running CLI Tools)

```typescript
import { spawn } from 'child_process'

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd })

    proc.stdout.on('data', (chunk: Buffer) => {
      onLog(chunk.toString().trim())
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      onLog(chunk.toString().trim())
    })

    proc.on('close', (code: number | null) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })

    proc.on('error', reject)
  })
}

// Usage
await runCommand(
  'railpack',
  ['build', '--name', imageName, sourceDir],
  workDir,
  (line) => emitter.emit('log', line)
)
```

---

## In-Memory Store (For This Project)

We're keeping this simple — no database. Just a Map:

```typescript
const deployments = new Map<string, Deployment>()

function getDeployment(id: string): Deployment {
  const d = deployments.get(id)
  if (!d) throw new Error(`Deployment ${id} not found`)
  return d
}

function updateStatus(id: string, status: DeploymentStatus): void {
  const d = getDeployment(id)
  deployments.set(id, { ...d, status, updatedAt: new Date() })
}

function listDeployments(): Deployment[] {
  return Array.from(deployments.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
```

---

## What to Remember

- Types are erased at runtime — they only help you at compile time and in the IDE
- `strict: true` in tsconfig — non-negotiable, catches the most bugs
- Use `tsx` for running TypeScript directly in development
- Error objects in catch blocks are `unknown` — always check `instanceof Error`
- Async pipelines: kick off background work without awaiting, handle errors with `.catch()`
- `EventEmitter` is the Node.js primitive for pub/sub — used to bridge the build process to SSE streams
