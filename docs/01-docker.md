# Docker — Images, Containers, Dockerfiles

## The Core Problem Docker Solves

Your app works on your laptop. You push it to a server — it breaks. Different OS, different Node version, missing library, wrong PATH.

Docker solves this by packaging your app **together with its entire environment** into one artifact. Same artifact runs identically everywhere.

---

## Key Concepts

### Image
A read-only snapshot of a filesystem + metadata. Like a class in OOP — you don't run an image directly, you instantiate it.

Built from a `Dockerfile`. Stored in a **registry** (Docker Hub, GitHub Container Registry, or your own).

### Container
A running instance of an image. Like an object. Isolated process on the host OS — has its own filesystem, network, and process space, but shares the host kernel.

```
Image  →  docker run  →  Container
Class  →  new Foo()   →  Object
```

### Docker Daemon
The background service that manages images and containers. When you run `docker` commands, you're talking to the daemon via a socket at `/var/run/docker.sock`.

This matters for our project — our backend talks to the Docker daemon directly to spawn user app containers.

---

## The Dockerfile

A recipe for building an image. Each instruction creates a **layer**.

```dockerfile
# Start from an existing base image (pulled from Docker Hub)
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files first (explained in Layers section)
COPY package.json package-lock.json ./

# Run a command during the build
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the app
RUN npm run build

# What command runs when the container starts
CMD ["node", "dist/index.js"]
```

### Important Instructions

| Instruction | What it does |
|-------------|-------------|
| `FROM` | Base image to start from |
| `WORKDIR` | Sets working directory for all following instructions |
| `COPY` | Copy files from host into image |
| `RUN` | Execute a command during the build (becomes a layer) |
| `ENV` | Set environment variables |
| `EXPOSE` | Document which port the app listens on (doesn't actually open anything) |
| `CMD` | Default command to run when container starts |
| `ENTRYPOINT` | Like CMD but harder to override — good for binaries |

---

## Layers and Caching

Every `RUN`, `COPY`, and `ADD` instruction creates a new layer. Layers are stacked.

**Why this matters:** Docker caches layers. If a layer's inputs haven't changed, Docker reuses the cached version. This makes rebuilds fast.

**The golden rule:** Put things that change least at the top, things that change most at the bottom.

```dockerfile
# BAD — copies all source first, so npm install re-runs every time ANY file changes
COPY . .
RUN npm install

# GOOD — copies package.json first. npm install only re-runs when dependencies change
COPY package.json package-lock.json ./
RUN npm install
COPY . .        # source changes don't invalidate the npm install layer
```

---

## Running Containers

```bash
# Run a container from an image
docker run nginx

# Run in background (detached)
docker run -d nginx

# Map host port 8080 to container port 80
docker run -p 8080:80 nginx

# Set environment variables
docker run -e DATABASE_URL=postgres://... myapp

# Mount a volume (host:container)
docker run -v /data:/app/data myapp

# Give the container a name
docker run --name my-container nginx

# Run and immediately delete when it stops
docker run --rm myapp

# Interactive terminal (useful for debugging)
docker run -it ubuntu bash
```

---

## Volumes

Containers are **ephemeral** — their internal filesystem changes disappear when the container stops. Volumes let data survive container restarts.

```bash
# Named volume (Docker manages where it lives)
docker run -v pg-data:/var/lib/postgresql/data postgres

# Bind mount (you control the path on the host)
docker run -v /Users/turner/data:/app/data myapp
```

In our project, we use a bind mount to give the backend access to the Docker daemon socket:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```
This is how our API can programmatically run `docker build` and `docker run` commands.

---

## Useful Commands

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# View logs from a container
docker logs <container-id>

# Follow logs in real time
docker logs -f <container-id>

# Stop a container
docker stop <container-id>

# Remove a container
docker rm <container-id>

# List images
docker images

# Remove an image
docker rmi <image-id>

# Build an image from a Dockerfile in current directory
docker build -t my-image-name .

# Pull an image from a registry
docker pull node:20-alpine

# Execute a command inside a running container (great for debugging)
docker exec -it <container-id> bash
```

---

## How This Project Uses Docker

1. **Backend container** — runs our Node.js API
2. **Frontend container** — runs Vite dev server (or static build)
3. **Caddy container** — the reverse proxy
4. **User app containers** — dynamically spawned by the backend when a deployment is triggered

The backend talks to Docker by:
- Mounting the Docker socket: `/var/run/docker.sock`
- Using the `dockerode` npm library to call Docker's API from Node.js

```typescript
import Docker from 'dockerode'
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

// Start a container programmatically
const container = await docker.createContainer({
  Image: 'my-built-image',
  ExposedPorts: { '3000/tcp': {} },
  HostConfig: {
    PortBindings: { '3000/tcp': [{ HostPort: '0' }] }  // 0 = random free port
  }
})
await container.start()
```

---

## What to Remember

- **Image** = frozen snapshot. **Container** = running instance.
- Layers are cached — order your Dockerfile to maximize cache hits.
- Volumes persist data beyond container lifecycle.
- Port mapping: `-p hostPort:containerPort`
- Docker daemon runs as a service; you talk to it via socket or TCP.
