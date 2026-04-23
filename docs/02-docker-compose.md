# Docker Compose — Multi-Service Orchestration

## The Problem

Running one container is easy. But a real system has multiple services — frontend, backend, database, proxy. Each needs:
- The right image or build context
- Environment variables
- Port mappings
- Volumes
- A shared network so they can talk to each other

Doing this manually with individual `docker run` commands means a long, fragile shell script you have to keep in sync.

**Docker Compose** lets you define the entire system in one `docker-compose.yml` file and start everything with one command.

---

## The docker-compose.yml Structure

```yaml
services:          # the containers that make up your system
  service-name:
    image: ...     # use a pre-built image
    build: ...     # or build from a Dockerfile
    ports: ...     # host:container port mapping
    environment:   # env vars
    volumes: ...   # volume mounts
    networks: ...  # which networks to join
    depends_on: .. # start order hints

networks:          # define shared networks
volumes:           # define named volumes
```

---

## Our docker-compose.yml Explained

```yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    networks:
      - app-net

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
    volumes:
      # Mount Docker socket so backend can spawn containers
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - app-net

  proxy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
      - "2019:2019"   # Caddy admin API
    volumes:
      - ./proxy/Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - app-net

networks:
  app-net:
    driver: bridge

volumes:
  caddy-data:
  caddy-config:
```

---

## Service Discovery (How Containers Find Each Other)

When services share a network, they can reach each other using the **service name as hostname**.

In our setup, all services are on `app-net`. So:
- `frontend` can reach `backend` at `http://backend:3001`
- `backend` can reach `proxy` at `http://proxy:2019`
- No need for IP addresses — Docker handles DNS internally

This is one of Compose's most useful features. No hardcoded IPs.

---

## Build vs Image

```yaml
# Use a pre-built image from a registry
image: postgres:16

# Build from a Dockerfile
build: ./backend

# Build with more control
build:
  context: ./backend      # the folder Docker sees during build
  dockerfile: Dockerfile  # relative to context
  args:
    NODE_ENV: production
```

---

## Environment Variables

```yaml
environment:
  # Inline value
  - NODE_ENV=production
  - PORT=3001

  # Read from your shell's environment
  - DATABASE_URL        # no = means "pass through from host"
```

Or use an env file:
```yaml
env_file:
  - .env
```

---

## depends_on

Controls start order. Doesn't wait for the service to be "ready" (just started):

```yaml
backend:
  depends_on:
    - db     # db container starts before backend
```

For true readiness (wait for postgres to accept connections), you need a healthcheck:
```yaml
db:
  healthcheck:
    test: ["CMD", "pg_isready", "-U", "postgres"]
    interval: 5s
    timeout: 5s
    retries: 5

backend:
  depends_on:
    db:
      condition: service_healthy
```

---

## Essential Commands

```bash
# Start everything (build images if needed)
docker compose up

# Start in background
docker compose up -d

# Rebuild images then start
docker compose up --build

# Stop everything
docker compose down

# Stop and remove volumes too
docker compose down -v

# View logs for all services
docker compose logs

# Follow logs for a specific service
docker compose logs -f backend

# Run a one-off command in a service
docker compose exec backend bash

# Check status of services
docker compose ps

# Rebuild a specific service
docker compose build backend

# Restart a specific service
docker compose restart backend
```

---

## Networking Deep Dive

By default, Compose creates a network named `<project>_default` and attaches all services. You can be explicit:

```yaml
networks:
  app-net:
    driver: bridge      # default — isolated virtual network on the host
  
  # driver: host        # container shares host network (no isolation)
  # driver: overlay     # multi-host networking (Docker Swarm)
```

**Bridge network** (what we use): Docker creates a virtual switch. Containers on the same bridge can communicate. Traffic from outside must come through published ports.

---

## Volumes in Compose

```yaml
volumes:
  # Named volume — Docker manages it
  caddy-data:

  # Named volume with explicit config
  pg-data:
    driver: local
```

Reference in a service:
```yaml
services:
  db:
    volumes:
      - pg-data:/var/lib/postgresql/data   # named volume
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql  # bind mount
```

---

## How This Project Uses Compose

`docker compose up --build` launches:
1. `frontend` — Vite dev server on :5173
2. `backend` — Node.js API on :3001, with Docker socket mounted
3. `proxy` — Caddy on :80/:443, with admin API on :2019

The backend mounts the Docker socket, which lets it programmatically:
- Build images via Railpack
- Run containers for user deployments
- Stop/remove containers when deployments are torn down

All three services share `app-net`, so the backend can call Caddy's admin API at `http://proxy:2019` to register new subdomains dynamically.

---

## What to Remember

- One `docker-compose.yml` = your entire local environment
- Services find each other by **service name** on the shared network
- `build:` for your own code, `image:` for third-party services
- Mount the Docker socket (`/var/run/docker.sock`) to give a container access to the Docker daemon
- `docker compose up --build` is your daily driver command
