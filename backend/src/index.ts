import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { Deployment } from './types'
import { getDeployment, listDeployments, saveDeployment, transition } from './store'
import { buildEmitters, runPipeline, stopDeploymentContainer } from './pipeline'

const app = express()
app.use(cors())
app.use(express.json())

// --- GET /deployments ---
// Returns all deployments, newest first
app.get('/deployments', (_req, res) => {
  res.json(listDeployments())
})

// --- GET /deployments/:id ---
// Returns a single deployment by ID
app.get('/deployments/:id', (req, res) => {
  try {
    res.json(getDeployment(req.params.id))
  } catch {
    res.status(404).json({ error: 'Deployment not found' })
  }
})

// --- POST /deployments ---
// Creates a new deployment and kicks off the pipeline in the background
app.post('/deployments', async (req, res) => {
  const { gitUrl } = req.body as { gitUrl?: string }

  if (!gitUrl || typeof gitUrl !== 'string') {
    res.status(400).json({ error: 'gitUrl is required' })
    return
  }

  const deployment: Deployment = {
    id: randomUUID().slice(0, 8),
    gitUrl,
    status: 'pending',
    logs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  saveDeployment(deployment)

  // Fire and forget — pipeline runs in background, client subscribes to /logs
  runPipeline(deployment).catch(console.error)

  res.status(201).json(deployment)
})

// --- DELETE /deployments/:id ---
// Stops a running deployment and removes its container + Caddy route
app.delete('/deployments/:id', async (req, res) => {
  try {
    const deployment = getDeployment(req.params.id)
    await stopDeploymentContainer(deployment)
    const updated = transition(req.params.id, 'stopped')
    res.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stop deployment'
    res.status(500).json({ error: message })
  }
})

// --- GET /deployments/:id/logs ---
// SSE endpoint — streams live build logs to the browser
// See docs/05-sse.md for a full explanation of how this works
app.get('/deployments/:id/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const { id } = req.params

  // Helper: writes one SSE event to the response
  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // If deployment is already done, replay stored logs and close
  let deployment: Deployment
  try {
    deployment = getDeployment(id)
  } catch {
    send({ type: 'error', message: 'Deployment not found' })
    res.end()
    return
  }

  // Replay logs captured before the client connected
  deployment.logs.forEach(line => send({ type: 'log', line }))

  const emitter = buildEmitters.get(id)
  if (!emitter) {
    // Build already finished — send current status and close
    send({ type: 'status', status: deployment.status })
    send({ type: 'done' })
    res.end()
    return
  }

  // Keep-alive heartbeat — prevents proxy/browser timeouts on long builds
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000)

  emitter.on('log', (line: string) => send({ type: 'log', line }))
  emitter.on('done', () => {
    const final = getDeployment(id)
    send({ type: 'status', status: final.status, url: final.url })
    send({ type: 'done' })
    clearInterval(heartbeat)
    res.end()
  })

  // Clean up when client disconnects early
  req.on('close', () => {
    clearInterval(heartbeat)
    emitter.removeAllListeners()
  })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
})
