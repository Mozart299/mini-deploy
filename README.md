# mini-deploy

A mini deployment platform built for learning. Submit a Git repo URL, get a live URL back. Streams build logs in real time.

Covers: Docker, Docker Compose, Railpack, Caddy, SSE, TanStack Router, TanStack Query, TypeScript.

---

## How it works

```
Git URL submitted
    → clone repo
    → Railpack builds a Docker image (no Dockerfile needed)
    → container starts on a random port
    → Caddy registers a subdomain route
    → live URL returned
```

Build logs stream to the browser in real time via Server-Sent Events.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React + TypeScript |
| Routing | TanStack Router |
| Data fetching | TanStack Query |
| Backend | Node.js + Express + TypeScript |
| Image builder | Railpack |
| Containers | Docker |
| Reverse proxy | Caddy |
| Real-time logs | Server-Sent Events (SSE) |

---

## Running the project

**Requires:** Docker Desktop

```bash
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:3001
- Deployed apps → http://app-<id>.localhost

To run just the frontend locally (no Docker):

```bash
cd frontend
npm run dev
```

---

## Project structure

```
mini-deploy/
├── docker-compose.yml
├── backend/
│   └── src/
│       ├── types.ts        deployment types + state machine
│       ├── store.ts        in-memory store
│       ├── pipeline.ts     clone → build → run → register
│       └── index.ts        Express API + SSE endpoint
├── frontend/
│   └── src/
│       ├── api/            fetch wrappers
│       ├── hooks/          useDeploymentLogs (SSE)
│       ├── components/     StatusBadge, LogViewer
│       ├── layouts/        RootLayout
│       └── routes/         DeploymentsPage, NewDeploymentPage, DeploymentDetailPage
├── proxy/
│   └── Caddyfile
└── docs/                   learning notes — read these
```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/deployments` | List all deployments |
| GET | `/deployments/:id` | Get single deployment |
| POST | `/deployments` | Create deployment `{ gitUrl }` |
| DELETE | `/deployments/:id` | Stop deployment |
| GET | `/deployments/:id/logs` | SSE stream of build logs |

---

## Deployment states

```
pending → building → deploying → running
                  ↘           ↘
                   failed      failed
running → stopped
```

---

## Learning docs

Start here if you're learning the concepts behind this project:

| Doc | Topic |
|-----|-------|
| [docs/00-overview.md](docs/00-overview.md) | Full system architecture |
| [docs/01-docker.md](docs/01-docker.md) | Docker — images, containers, Dockerfiles |
| [docs/02-docker-compose.md](docs/02-docker-compose.md) | Docker Compose — multi-service orchestration |
| [docs/03-railpack.md](docs/03-railpack.md) | Railpack — auto-build without a Dockerfile |
| [docs/04-caddy.md](docs/04-caddy.md) | Caddy — reverse proxy + auto HTTPS + dynamic config |
| [docs/05-sse.md](docs/05-sse.md) | Server-Sent Events — real-time log streaming |
| [docs/06-tanstack-router.md](docs/06-tanstack-router.md) | TanStack Router — type-safe client routing |
| [docs/07-tanstack-query.md](docs/07-tanstack-query.md) | TanStack Query — server state, caching, polling |
| [docs/08-typescript-backend.md](docs/08-typescript-backend.md) | TypeScript backend patterns |
| [docs/09-deployment-state-machine.md](docs/09-deployment-state-machine.md) | State machine design |
