# The Deployment State Machine

## What is a State Machine?

A state machine is a model where a system can be in exactly **one state at a time**, and transitions between states are explicit and controlled.

Instead of:
```typescript
deployment.isBuilding = true
deployment.isDeploying = false
deployment.isFailed = false
// ...tracking 5 booleans that can conflict
```

You have:
```typescript
deployment.status = 'building'
// One source of truth, no conflicting combinations possible
```

---

## The Deployment States

```
                    ┌─────────┐
         start      │         │
    ──────────────▶ │ pending │
                    │         │
                    └────┬────┘
                         │ build starts
                         ▼
                    ┌─────────┐
                    │         │
                    │building │ ◀─── Railpack running
                    │         │
                    └────┬────┘
                         │ image built
                    ┌────┴────┐
                    │         │ image build failed
                    │         ├──────────────────────▶ ┌────────┐
                    │         │                        │ failed │
                    ▼         │                        └────────┘
               ┌──────────┐   │
               │          │   │
               │deploying │   │ container crashed
               │          ├───┘
               └────┬─────┘
                    │ health check passes
                    ▼
               ┌─────────┐
               │         │
               │ running │ ◀─── live URL active
               │         │
               └────┬────┘
                    │ user stops it
                    ▼
               ┌─────────┐
               │ stopped │
               └─────────┘
```

---

## TypeScript Representation

```typescript
type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'deploying'
  | 'running'
  | 'failed'
  | 'stopped'

interface Deployment {
  id: string
  gitUrl: string
  status: DeploymentStatus
  port?: number           // only set when running
  url?: string            // only set when running
  error?: string          // only set when failed
  logs: string[]          // accumulated log lines
  createdAt: Date
  updatedAt: Date
}
```

Using a union type for status means TypeScript will force you to handle all cases:

```typescript
function getStatusColor(status: DeploymentStatus): string {
  switch (status) {
    case 'pending':   return 'gray'
    case 'building':  return 'yellow'
    case 'deploying': return 'blue'
    case 'running':   return 'green'
    case 'failed':    return 'red'
    case 'stopped':   return 'gray'
    // TypeScript error if you forget a case!
  }
}
```

---

## Valid Transitions

Not all transitions are valid. You can't go from `running` back to `building`. Encoding valid transitions makes bugs obvious:

```typescript
const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  pending:   ['building', 'failed'],
  building:  ['deploying', 'failed'],
  deploying: ['running', 'failed'],
  running:   ['stopped', 'failed'],
  failed:    [],   // terminal state
  stopped:   [],   // terminal state
}

function transition(
  deployment: Deployment,
  newStatus: DeploymentStatus
): Deployment {
  const allowed = VALID_TRANSITIONS[deployment.status]
  
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${deployment.status} → ${newStatus}`
    )
  }
  
  return {
    ...deployment,
    status: newStatus,
    updatedAt: new Date(),
  }
}
```

---

## What Triggers Each Transition

| Transition | What triggers it |
|------------|----------------|
| `pending → building` | `runPipeline()` starts, `git clone` succeeds |
| `building → deploying` | Railpack exits with code 0 (image built) |
| `deploying → running` | Container starts, health check passes, Caddy route registered |
| `* → failed` | Any error in the pipeline |
| `running → stopped` | User calls DELETE /deployments/:id |

---

## The Pipeline Orchestrator

```typescript
async function runPipeline(deployment: Deployment): Promise<void> {
  const { id } = deployment
  const emitter = getEmitter(id)  // for SSE log streaming

  // Step 1: Clone
  await updateStatus(id, 'building')
  emitLog(id, `Cloning ${deployment.gitUrl}...`)
  
  const sourceDir = `/tmp/builds/${id}`
  await runCommand('git', ['clone', deployment.gitUrl, sourceDir], {
    onLog: (line) => emitLog(id, line)
  })

  // Step 2: Build
  const imageName = `deploy-${id}`
  emitLog(id, 'Building image with Railpack...')
  
  await runCommand('railpack', ['build', '--name', imageName, sourceDir], {
    onLog: (line) => emitLog(id, line)
  })

  // Step 3: Deploy
  await updateStatus(id, 'deploying')
  emitLog(id, 'Starting container...')
  
  const port = await startContainer(imageName)
  
  // Step 4: Register route
  const subdomain = `app-${id}`
  await registerWithCaddy(subdomain, port)
  
  const url = `http://${subdomain}.localhost`
  await updateDeployment(id, { status: 'running', port, url })
  
  emitLog(id, `Deployment live at ${url}`)
  emitter.emit('done')
}
```

---

## Frontend: Reflecting State

The UI should communicate state visually. Each status maps to a color, icon, and message:

```tsx
const STATUS_CONFIG = {
  pending:   { color: 'gray',   label: 'Queued',     spinner: false },
  building:  { color: 'yellow', label: 'Building...',spinner: true  },
  deploying: { color: 'blue',   label: 'Deploying...', spinner: true },
  running:   { color: 'green',  label: 'Live',        spinner: false },
  failed:    { color: 'red',    label: 'Failed',      spinner: false },
  stopped:   { color: 'gray',   label: 'Stopped',     spinner: false },
}

function StatusBadge({ status }: { status: DeploymentStatus }) {
  const { color, label, spinner } = STATUS_CONFIG[status]
  return (
    <span className={`badge badge-${color}`}>
      {spinner && <Spinner />}
      {label}
    </span>
  )
}
```

---

## What to Remember

- State machines make impossible states impossible — one `status` field beats five booleans
- Define valid transitions explicitly — prevents nonsensical state jumps
- TypeScript union types + exhaustive switch = compile-time safety
- Terminal states (`failed`, `stopped`) have no outgoing transitions
- The pipeline function maps directly to state transitions: each step = one `updateStatus()` call
