import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync, mkdirSync, rmSync } from 'fs'
import path from 'path'
import Docker from 'dockerode'
import { Deployment } from './types'
import { appendLog, transition } from './store'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

// Active build emitters — deployment ID → EventEmitter
// SSE endpoints subscribe to these to stream logs to the browser
export const buildEmitters = new Map<string, EventEmitter>()

// Active child processes — allows in-progress pipelines to be cancelled
const activeProcesses = new Map<string, ChildProcess>()

const BUILD_DIR = '/tmp/mini-deploy-builds'

export async function runPipeline(deployment: Deployment): Promise<void> {
  const { id, gitUrl } = deployment
  const emitter = new EventEmitter()
  buildEmitters.set(id, emitter)

  const log = (line: string) => {
    appendLog(id, line)
    emitter.emit('log', line)
  }

  try {
    // --- Phase 1: Clone ---
    transition(id, 'building')
    const sourceDir = path.join(BUILD_DIR, id)
    if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true })

    log(`Cloning ${gitUrl}...`)
    await runCommand(id, 'git', ['clone', '--depth=1', gitUrl, sourceDir], log)
    log('Clone complete.')

    // --- Phase 2: Build image with Railpack ---
    const imageName = `mini-deploy-${id}`
    log(`Building image with Railpack...`)
    await runCommand(id, 'railpack', ['build', '--name', imageName, sourceDir], log)
    log(`Image ${imageName} built successfully.`)

    // --- Phase 3: Run container ---
    transition(id, 'deploying')
    log('Starting container...')
    const port = await startContainer(imageName)
    log(`Container started on port ${port}`)

    // --- Phase 4: Register with Caddy ---
    const subdomain = `app-${id}`
    await registerWithCaddy(subdomain, port)
    const url = `http://${subdomain}.localhost`
    log(`Route registered: ${url}`)

    transition(id, 'running', { port, url })
    log(`Deployment live at ${url}`)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Don't overwrite a cancelled (stopped) deployment with failed
    const { getDeployment } = await import('./store')
    const current = getDeployment(id)
    if (current.status !== 'stopped') {
      log(`Pipeline failed: ${message}`)
      transition(id, 'failed', { error: message })
    }
  } finally {
    activeProcesses.delete(id)
    emitter.emit('done')
    buildEmitters.delete(id)
    const sourceDir = path.join(BUILD_DIR, id)
    if (existsSync(sourceDir)) rmSync(sourceDir, { recursive: true, force: true })
  }
}

export function cancelPipeline(id: string): void {
  const proc = activeProcesses.get(id)
  if (proc) {
    proc.kill('SIGTERM')
    activeProcesses.delete(id)
  }
}

// Runs a CLI command, streaming each line of output to the log callback
function runCommand(id: string, cmd: string, args: string[], onLog: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args)
    activeProcesses.set(id, proc)

    proc.stdout.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(onLog)
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(onLog)
    })

    proc.on('close', (code, signal) => {
      activeProcesses.delete(id)
      if (signal) reject(new Error(`${cmd} killed with signal ${signal}`))
      else if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })

    proc.on('error', reject)
  })
}

// Creates and starts a Docker container, returns the host port it was assigned
async function startContainer(imageName: string): Promise<number> {
  const container = await docker.createContainer({
    Image: imageName,
    ExposedPorts: { '3000/tcp': {} },
    HostConfig: {
      PortBindings: {
        '3000/tcp': [{ HostPort: '0' }]  // '0' = Docker picks a free port
      }
    }
  })

  await container.start()

  const info = await container.inspect()
  const portStr = info.NetworkSettings.Ports['3000/tcp']?.[0]?.HostPort
  if (!portStr) throw new Error('Container did not expose port 3000')

  return parseInt(portStr, 10)
}

// Registers a subdomain → port mapping with Caddy's Admin API
async function registerWithCaddy(subdomain: string, port: number): Promise<void> {
  const caddyAdminUrl = process.env.CADDY_ADMIN_URL ?? 'http://proxy:2019'

  const route = {
    '@id': `route-${subdomain}`,
    match: [{ host: [`${subdomain}.localhost`] }],
    handle: [{
      handler: 'reverse_proxy',
      upstreams: [{ dial: `localhost:${port}` }]
    }]
  }

  const res = await fetch(`${caddyAdminUrl}/config/apps/http/servers/srv0/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route)
  })

  if (!res.ok) throw new Error(`Caddy registration failed: ${res.statusText}`)
}

export async function stopDeploymentContainer(deployment: Deployment): Promise<void> {
  if (!deployment.port) return

  // Remove Caddy route
  const caddyAdminUrl = process.env.CADDY_ADMIN_URL ?? 'http://proxy:2019'
  const subdomain = `app-${deployment.id}`
  await fetch(`${caddyAdminUrl}/id/route-${subdomain}`, { method: 'DELETE' })

  // Stop and remove the container by image name
  const containers = await docker.listContainers()
  for (const c of containers) {
    if (c.Image === `mini-deploy-${deployment.id}`) {
      const container = docker.getContainer(c.Id)
      await container.stop()
      await container.remove()
    }
  }
}
