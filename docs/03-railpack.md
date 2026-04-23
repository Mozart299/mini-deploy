# Railpack — Auto-Build Without a Dockerfile

## The Problem

If you give a user a deployment platform, they'll submit raw source code — a Node app, a Python Flask server, a Go binary. Most of them haven't written a Dockerfile.

You need a way to take arbitrary source code and produce a runnable Docker image automatically.

---

## What Railpack Does

Railpack is a build tool that:
1. **Inspects** your source code
2. **Detects** what kind of project it is (Node, Python, Go, Ruby, Rust, PHP, etc.)
3. **Figures out** the build commands and runtime requirements
4. **Outputs** an optimized Docker image

Zero Dockerfile needed.

```
Source code  →  railpack build  →  Docker image  →  docker run
```

---

## How Detection Works

Railpack looks at files in your repo to identify the stack:

| What it finds | What it detects |
|---------------|----------------|
| `package.json` | Node.js |
| `requirements.txt` / `pyproject.toml` | Python |
| `go.mod` | Go |
| `Gemfile` | Ruby |
| `Cargo.toml` | Rust |
| `composer.json` | PHP |

It also inspects the content — if `package.json` has a `"start"` script, it uses that as the run command. If there's a `next.config.js`, it knows it's Next.js and handles the build differently.

---

## Similar Tools (Context)

Railpack belongs to a category of tools called **buildpacks** or **auto-builders**:

| Tool | Used By |
|------|---------|
| Heroku Buildpacks | Heroku (the original) |
| Nixpacks | Railway (Railpack is inspired by this) |
| Buildpacks (CNB) | Google Cloud Run, Paketo |
| Railpack | Brimble |

They all solve the same problem. Railpack is newer and uses a different approach internally — it leverages `mise` for version management and produces leaner images.

---

## Using Railpack

### Install

```bash
# macOS
brew install railwayapp/tap/railpack

# Or via curl
curl -fsSL https://railpack.io/install.sh | bash
```

### Build an image from source

```bash
# In the directory containing your source code
railpack build --name my-app .

# This outputs a Docker image tagged "my-app"
# You can then run it:
docker run -p 3000:3000 my-app
```

### Inspect what Railpack detects

```bash
railpack detect .
# Output: detected Node.js 20 project, build: npm run build, start: npm start
```

---

## How Our Backend Uses Railpack

The backend runs Railpack as a **child process** and streams its output to the browser via SSE.

```typescript
import { spawn } from 'child_process'

function buildWithRailpack(sourceDir: string, imageName: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('railpack', ['build', '--name', imageName, sourceDir])

    proc.stdout.on('data', (chunk) => {
      // Stream each line of output to the SSE connection
      emitLog(chunk.toString())
    })

    proc.stderr.on('data', (chunk) => {
      emitLog(chunk.toString())
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Railpack exited with code ${code}`))
    })
  })
}
```

The key insight: `spawn` gives you access to the process's stdout and stderr **as streams**. You can pipe each chunk directly to the browser as it's produced — the user sees logs in real time.

---

## After the Build

Once Railpack finishes, we have a Docker image. Then:

```typescript
// 1. Create the container
const container = await docker.createContainer({
  Image: imageName,
  HostConfig: {
    PortBindings: {
      '3000/tcp': [{ HostPort: '0' }]  // '0' = let Docker pick a free port
    }
  }
})

// 2. Start it
await container.start()

// 3. Find out which port Docker assigned
const info = await container.inspect()
const assignedPort = info.NetworkSettings.Ports['3000/tcp'][0].HostPort

// 4. Register with Caddy (see caddy.md)
await registerSubdomain(deploymentId, assignedPort)
```

---

## What to Remember

- Railpack auto-detects your stack and builds a Docker image — no Dockerfile needed
- It's a CLI tool; our backend runs it as a child process
- Streaming stdout/stderr from a child process = real-time build logs
- After the build: image name → `docker run` → dynamic port → Caddy route
