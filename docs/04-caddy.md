# Caddy — Reverse Proxy with Auto HTTPS

## What is a Reverse Proxy?

Your user app runs inside a container on some port like `3847`. Nobody wants to visit `yourserver.com:3847`.

A **reverse proxy** sits in front of all your services. It's the single entry point — accepts traffic on port 80 (HTTP) and 443 (HTTPS), then forwards each request to the right backend based on hostname or path.

```
Request: https://my-app.brimble.app
    │
    ▼
  Caddy  ──────────────────────────────→  container on :3847
    │
    ├──→  https://other-app.brimble.app  →  container on :4201
    │
    └──→  https://api.brimble.app        →  backend API on :3001
```

Every platform (Vercel, Netlify, Railway, Heroku) has a routing layer that does exactly this.

---

## Why Caddy (Not Nginx)?

**Nginx** is the traditional choice. Powerful, but:
- SSL config is manual — you need Certbot, cron jobs for renewal
- Config changes require reload
- Config syntax is verbose

**Caddy** advantages:
- **Auto HTTPS** — provisions and renews TLS certs via Let's Encrypt with zero config
- **Dynamic config** — change routing at runtime via a JSON Admin API (no restart)
- **Simple config** syntax (Caddyfile)
- Written in Go — fast and single binary

For a deployment platform where we need to **add new routes dynamically as deployments come online**, Caddy's Admin API is exactly what we need.

---

## The Caddyfile (Static Config)

The simplest Caddy config:

```
localhost {
    respond "Hello from Caddy"
}
```

A reverse proxy:
```
my-app.example.com {
    reverse_proxy localhost:3000
}
```

Multiple sites:
```
app1.example.com {
    reverse_proxy localhost:3001
}

app2.example.com {
    reverse_proxy localhost:3002
}
```

Caddy automatically handles HTTPS for each domain — fetches cert from Let's Encrypt on first request.

---

## The Admin API (Dynamic Config)

This is the key feature for our project. Instead of editing the Caddyfile and reloading, we send HTTP requests to Caddy's Admin API at `:2019`.

Caddy's config is a JSON object. You can read or write any part of it via REST endpoints.

### Get current config
```bash
curl http://localhost:2019/config/
```

### Add a new reverse proxy route dynamically

When a new deployment is ready, we call:
```bash
curl -X POST http://localhost:2019/config/apps/http/servers/srv0/routes \
  -H "Content-Type: application/json" \
  -d '{
    "match": [{"host": ["my-new-app.localhost"]}],
    "handle": [{
      "handler": "reverse_proxy",
      "upstreams": [{"dial": "localhost:4523"}]
    }]
  }'
```

No restart. The new subdomain is live immediately.

### Remove a route (when deployment is stopped)
```bash
# Routes have IDs you can use to delete them
curl -X DELETE http://localhost:2019/id/route-my-new-app
```

---

## Our Caddyfile for Development

```
{
    # Use local CA for HTTPS in development (no Let's Encrypt)
    local_certs
    # Admin API (already default, but being explicit)
    admin 0.0.0.0:2019
}

:80 {
    # Catch-all — frontend dev server
    reverse_proxy frontend:5173
}
```

In development we use `*.localhost` subdomains. Caddy handles local HTTPS with its built-in local CA.

---

## How Our Backend Talks to Caddy

After a deployment container starts and gets a port, the backend calls Caddy's Admin API:

```typescript
async function registerDeployment(subdomain: string, port: number) {
  const route = {
    '@id': `route-${subdomain}`,  // ID lets us delete it later
    match: [{ host: [`${subdomain}.localhost`] }],
    handle: [{
      handler: 'reverse_proxy',
      upstreams: [{ dial: `localhost:${port}` }]
    }]
  }

  await fetch('http://proxy:2019/config/apps/http/servers/srv0/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route)
  })
}

async function unregisterDeployment(subdomain: string) {
  await fetch(`http://proxy:2019/id/route-${subdomain}`, {
    method: 'DELETE'
  })
}
```

Notice `proxy:2019` — `proxy` is the Caddy service name in Docker Compose. Services on the same network reach each other by service name.

---

## The Request Flow End-to-End

```
1. User visits https://abc123.localhost

2. Browser → Caddy (:443)

3. Caddy checks its route table:
   - Does "abc123.localhost" match any route? Yes.
   - That route says: forward to localhost:4821

4. Caddy → user's container on :4821

5. Container responds → Caddy → Browser
```

The user's app has no idea about Caddy. It just receives normal HTTP requests.

---

## Subdomain Strategy

For local dev, we use `<deploymentId>.localhost`. Browsers treat `.localhost` as localhost automatically — no DNS config needed.

For production, you'd:
1. Have a wildcard DNS record: `*.yourdomain.com → your-server-IP`
2. Caddy issues a wildcard certificate or per-subdomain certs

---

## What to Remember

- Reverse proxy = single entry point that routes to the right backend by hostname
- Caddy = auto HTTPS + hot-reloadable dynamic config via Admin API at `:2019`
- We call Caddy's API from our backend (via `http://proxy:2019`) after each container starts
- Route IDs (`@id`) let us delete routes when deployments are removed
- In dev: `*.localhost` subdomains, Caddy local CA for HTTPS
