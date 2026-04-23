# TanStack Router — Type-Safe Client Routing

## What is Client-Side Routing?

In a traditional multi-page app, every URL change is a new request to the server. The server returns a new HTML page.

In a Single Page Application (SPA), the browser loads once. JavaScript intercepts navigation and swaps out content without full page reloads. The URL still changes (via the History API) so the back button works.

**A router** manages this: it maps URL patterns to components and handles navigation.

---

## Why TanStack Router (Not React Router)?

React Router is the classic choice. TanStack Router is newer (v1 released 2024) with one major differentiator:

**Full end-to-end type safety.**

With React Router:
```tsx
// params are typed as Record<string, string | undefined>
const { deploymentId } = useParams()
// deploymentId is string | undefined — you might forget to check
```

With TanStack Router:
```tsx
// params are inferred from your route definition
const { deploymentId } = Route.useParams()
// deploymentId is string — TypeScript knows it exists on this route
```

Route params, search params, and loader data are all typed. TypeScript will catch typos and missing param checks at compile time.

---

## Core Concepts

### Routes

A route is a mapping from a URL pattern to a component. Routes form a **tree** — nested routes render inside parent routes.

```
/                         →  RootLayout
├── /                     →  HomePage
├── /deployments          →  DeploymentsPage
└── /deployments/$id      →  DeploymentDetailPage
```

The `$` prefix marks a **dynamic segment** (a param).

### Route Tree

```typescript
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

// Root route — wraps everything
const rootRoute = createRootRoute({
  component: RootLayout,
})

// /
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// /deployments
const deploymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deployments',
  component: DeploymentsPage,
})

// /deployments/$id
const deploymentRoute = createRoute({
  getParentRoute: () => deploymentsRoute,
  path: '$id',                            // dynamic segment
  component: DeploymentDetailPage,
})

// Wire them all together
const routeTree = rootRoute.addChildren([
  indexRoute,
  deploymentsRoute.addChildren([deploymentRoute]),
])

export const router = createRouter({ routeTree })
```

### Using Params in a Component

```tsx
function DeploymentDetailPage() {
  // id is typed as string — TanStack infers it from path: '$id'
  const { id } = deploymentRoute.useParams()

  return <div>Deployment: {id}</div>
}
```

---

## File-Based Routing (What We Use)

Instead of defining routes manually, you can use the file system. TanStack Router watches your `routes/` folder and auto-generates the route tree.

### File Structure → Routes

```
src/routes/
├── __root.tsx              →  / (root layout)
├── index.tsx               →  /
├── deployments/
│   ├── index.tsx           →  /deployments
│   └── $id/
│       ├── index.tsx       →  /deployments/$id
│       └── logs.tsx        →  /deployments/$id/logs
```

Special filenames:
- `__root.tsx` — the root layout component
- `index.tsx` — matches the parent path exactly
- `$param` — dynamic segment
- `_layout.tsx` — layout file (doesn't affect the URL)

### The Route File

Each file exports a `Route` object:

```tsx
// src/routes/deployments/$id/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/deployments/$id/')({
  component: DeploymentDetailPage,
  // Optional: loader runs before the component renders
  loader: ({ params }) => fetchDeployment(params.id),
})

function DeploymentDetailPage() {
  const { id } = Route.useParams()
  const deployment = Route.useLoaderData()  // typed from loader return

  return <div>{deployment.status}</div>
}
```

---

## Search Params

URL search params (`?tab=logs&page=2`) are also typed:

```tsx
export const Route = createFileRoute('/deployments')({
  validateSearch: (search) => ({
    tab: (search.tab as string) ?? 'overview',
    page: Number(search.page ?? 1),
  }),
  component: DeploymentsPage,
})

function DeploymentsPage() {
  const { tab, page } = Route.useSearch()
  // tab: string, page: number — typed!
}
```

---

## Navigation

```tsx
import { Link, useNavigate } from '@tanstack/react-router'

// Declarative link
<Link to="/deployments/$id" params={{ id: deployment.id }}>
  View Deployment
</Link>
// TypeScript error if you forget `params` or spell the route wrong

// Programmatic navigation
const navigate = useNavigate()
navigate({ to: '/deployments/$id', params: { id: newDeployment.id } })
```

---

## Loaders (Data Before Render)

Route loaders fetch data before the component renders. This avoids the "loading spinner on every navigation" pattern.

```tsx
export const Route = createFileRoute('/deployments/$id/')({
  loader: async ({ params }) => {
    const deployment = await fetchDeployment(params.id)
    return deployment
  },
  component: DeploymentDetailPage,
  // Show this while loading (optional)
  pendingComponent: () => <div>Loading...</div>,
  // Show this on error (optional)
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
})

function DeploymentDetailPage() {
  // No loading state needed — data is ready when component mounts
  const deployment = Route.useLoaderData()
  return <div>{deployment.status}</div>
}
```

TanStack Router integrates with TanStack Query — loaders can populate the query cache so components use `useQuery` for realtime updates.

---

## Outlet

The `Outlet` component renders the active child route. Required in parent layout components:

```tsx
// __root.tsx
import { Outlet } from '@tanstack/react-router'

function RootLayout() {
  return (
    <div>
      <nav>...</nav>
      <main>
        <Outlet />  {/* child route renders here */}
      </main>
    </div>
  )
}
```

---

## Router Provider (Entry Point)

Wire the router into your app once at the root:

```tsx
// main.tsx
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
)
```

---

## What to Remember

- TanStack Router's killer feature is **type-safe routes** — params, search params, and loader data are all inferred types
- Use file-based routing — easier to navigate, auto-generates the tree
- `Route.useParams()` > `useParams()` — the route-scoped version is typed
- Loaders fetch data before render — no waterfall loading states
- `<Link to="..." params={...}>` — TypeScript catches invalid routes at compile time
