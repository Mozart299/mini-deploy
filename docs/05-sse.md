# Server-Sent Events (SSE) — Real-Time Log Streaming

## The Problem

When Railpack is building a Docker image, the build takes time. Dozens of log lines pour out. You want to show them to the user live — not wait until the entire build is done and dump them all at once.

You need a way for the **server to push data to the browser** continuously.

---

## Three Options for Real-Time Data

### 1. Polling
Client asks the server "got anything new?" every N seconds.
- Simple to implement
- Wastes bandwidth — most polls get nothing
- Latency = poll interval
- Fine for deployment status, bad for streaming logs

### 2. WebSockets
Full bidirectional connection. Both sides can send at any time.
- Separate protocol (`ws://`)
- Great for chat, games, collaborative editing
- Overkill when only the server needs to send data

### 3. Server-Sent Events (SSE)
Server pushes data to client over a long-lived HTTP connection. Client can't send back on the same connection.
- Built on regular HTTP/HTTPS
- Browser has native `EventSource` API
- Simple to implement
- **Perfect for log streaming** — the server is always the sender

**For build logs, SSE is the right choice.** We never need the client to send data back through the same stream.

---

## How SSE Works

1. Client makes a normal GET request but keeps the connection open
2. Server sets `Content-Type: text/event-stream`
3. Server writes lines in a specific format, flushing after each
4. Client receives events as they arrive

### The SSE Wire Format

Data on the wire is plain text with a specific format:

```
data: Hello world\n\n
```

Every event ends with **two newlines** (`\n\n`). Single newline = continuation of current event.

More complex events:
```
id: 42\n
event: build-log\n
data: Step 3/5: RUN npm install\n
\n
```

Fields:
- `data:` — the payload (required)
- `id:` — event ID (browser uses this to resume from last event on reconnect)
- `event:` — custom event type (client listens for it specifically)
- `retry:` — tell client how long to wait before reconnecting

---

## Server Implementation (Node.js + Express)

```typescript
app.get('/deployments/:id/logs', (req, res) => {
  const { id } = req.params

  // These headers are required for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Helper to send an event
  const send = (data: string) => {
    res.write(`data: ${data}\n\n`)
    // res.flush() may be needed depending on compression middleware
  }

  // Send a heartbeat every 15s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')  // lines starting with : are comments, ignored by client
  }, 15_000)

  // Attach to the build process for this deployment
  const build = getActiveBuild(id)
  
  if (!build) {
    send(JSON.stringify({ type: 'error', message: 'No active build' }))
    res.end()
    return
  }

  build.on('log', (line: string) => {
    send(JSON.stringify({ type: 'log', line }))
  })

  build.on('status', (status: string) => {
    send(JSON.stringify({ type: 'status', status }))
  })

  build.on('done', () => {
    send(JSON.stringify({ type: 'done' }))
    clearInterval(heartbeat)
    res.end()
  })

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(heartbeat)
    build.removeAllListeners()
  })
})
```

---

## Client Implementation (React + EventSource)

### Raw EventSource API (built into every browser)

```typescript
const source = new EventSource(`/deployments/${deploymentId}/logs`)

source.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  if (data.type === 'log') {
    setLogs(prev => [...prev, data.line])
  }
  
  if (data.type === 'status') {
    setStatus(data.status)
  }
  
  if (data.type === 'done') {
    source.close()  // stop listening
  }
}

source.onerror = (err) => {
  console.error('SSE error', err)
  source.close()
}

// Close when component unmounts
return () => source.close()
```

### With TanStack Query + Custom Hook

```typescript
function useDeploymentLogs(deploymentId: string) {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<string>('pending')

  useEffect(() => {
    const source = new EventSource(`/api/deployments/${deploymentId}/logs`)

    source.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'log') setLogs(prev => [...prev, data.line])
      if (data.type === 'status') setStatus(data.status)
      if (data.type === 'done') source.close()
    }

    return () => source.close()
  }, [deploymentId])

  return { logs, status }
}
```

---

## Rendering the Log Stream

```tsx
function LogViewer({ deploymentId }: { deploymentId: string }) {
  const { logs, status } = useDeploymentLogs(deploymentId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="bg-black text-green-400 font-mono p-4 h-96 overflow-y-auto">
      {logs.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

---

## SSE vs WebSocket Decision Guide

| Scenario | Use |
|----------|-----|
| Build/deploy logs | SSE |
| Deployment status updates | SSE (or polling) |
| Chat application | WebSocket |
| Collaborative document editing | WebSocket |
| Live notifications (one-way) | SSE |
| Game state sync | WebSocket |
| Stock ticker | SSE |

---

## Auto-Reconnect

Browsers **automatically reconnect** if an SSE connection drops. By default after 3 seconds. You can change it:

```
retry: 5000\n
\n
```

On reconnect, the browser sends `Last-Event-ID` header with the last received event ID. Your server can use this to replay missed events:

```typescript
const lastId = req.headers['last-event-id']
if (lastId) {
  // Replay events since lastId
}
```

---

## What to Remember

- SSE = server pushes, client listens. One direction only.
- Headers required: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- Each event ends with `\n\n`
- Native browser API: `new EventSource(url)`
- Always clean up: `source.close()` on component unmount and `req.on('close')` on server
- Browsers auto-reconnect. Use event IDs if you need to replay missed events.
- SSE works over HTTP/2 (multiple streams over one TCP connection)
