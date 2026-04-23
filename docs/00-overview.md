# Mini Deploy — Project Overview

## What This Project Is

A mini version of Vercel / Railway / Render built from scratch.

You give it a Git repo URL (or a zip file). It:
1. Clones the code
2. Builds it into a Docker image automatically (no Dockerfile needed)
3. Runs that image as a container
4. Exposes it at a live URL via a reverse proxy
5. Streams all build/deploy logs to your browser in real time

This is exactly what every modern deployment platform does under the hood.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Caddy   │    │   Backend API    │    │    Frontend      │  │
│  │ :80/:443 │    │   (Node + TS)    │    │  (Vite + React)  │  │
│  │ (proxy)  │    │     :3001        │    │    :5173         │  │
│  └────┬─────┘    └────────┬─────────┘    └──────────────────┘  │
│       │                   │                                     │
│       │          ┌────────▼──────────────┐                     │
│       │          │   Docker Daemon       │                     │
│       │          │   (spawns user app    │                     │
│       │          │    containers)        │                     │
│       │          └───────────────────────┘                     │
│       │                                                         │
│  ┌────▼────────────────────────────────────────────────────┐   │
│  │  app-xyz.localhost  →  user container on dynamic port   │   │
│  │  app-abc.localhost  →  user container on dynamic port   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Vite + React + TypeScript | Fast dev server, type safety |
| Routing | TanStack Router | Fully type-safe routes and params |
| Data fetching | TanStack Query | Server state, caching, polling |
| Backend | Node.js + TypeScript | API, deployment orchestration |
| Build pipeline | Railpack | Auto-detects stack, builds Docker image |
| Containerization | Docker + Docker Compose | Isolated, reproducible environments |
| Reverse proxy | Caddy | Auto HTTPS, dynamic config via API |
| Real-time | Server-Sent Events (SSE) | Stream build logs to browser |

---

## Deployment Lifecycle

```
User submits Git URL
       │
       ▼
[pending] — saved to DB/store
       │
       ▼
Clone repo → Run Railpack
[building] — streaming logs via SSE
       │
       ▼
docker run <image>
[deploying] — container starting
       │
       ▼
Health check passes + Caddy route registered
[running] — live URL active
       │
       ▼ (on any error)
[failed] — error message stored
```

---

## Learning Docs Index

| File | Topic |
|------|-------|
| [01-docker.md](./01-docker.md) | Docker — images, containers, Dockerfiles, layers |
| [02-docker-compose.md](./02-docker-compose.md) | Docker Compose — multi-service orchestration |
| [03-railpack.md](./03-railpack.md) | Railpack — auto-build without a Dockerfile |
| [04-caddy.md](./04-caddy.md) | Caddy — reverse proxy, auto HTTPS, dynamic config |
| [05-sse.md](./05-sse.md) | Server-Sent Events — real-time log streaming |
| [06-tanstack-router.md](./06-tanstack-router.md) | TanStack Router — type-safe client routing |
| [07-tanstack-query.md](./07-tanstack-query.md) | TanStack Query — server state management |
| [08-typescript-backend.md](./08-typescript-backend.md) | TypeScript backend patterns used in this project |
| [09-deployment-state-machine.md](./09-deployment-state-machine.md) | The deployment state machine design |

---

## Running the Project

```bash
docker compose up --build
```

That's it. Everything starts: frontend, backend, proxy.

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Deployed apps: http://<subdomain>.localhost
