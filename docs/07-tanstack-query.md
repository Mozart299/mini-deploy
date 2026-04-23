# TanStack Query — Server State Management

## Two Types of State

| UI State | Server State |
|----------|-------------|
| Modal open/closed | List of deployments |
| Active tab | Deployment status |
| Form input value | User profile |
| Dark/light mode | Build logs |

**UI state** lives entirely in the browser. Easy — just `useState`.

**Server state** is different:
- Lives on the server, you just have a cached copy
- Can go stale — someone else might have updated it
- Multiple components might need the same data
- You need to handle loading, error, refetching
- You want to avoid re-fetching the same data unnecessarily

Doing this manually gets messy fast. TanStack Query handles it for you.

---

## Core Concept: The Query

A **query** is a declarative data subscription. You say "I need this data" and TanStack Query handles fetching, caching, refetching, and deduplication.

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['deployment', id],   // cache key
  queryFn: () => fetchDeployment(id),  // how to fetch
})
```

That's it. TanStack Query:
- Fetches on mount
- Returns cached data instantly on re-mount (while revalidating in background)
- Deduplicates — 10 components asking for the same key = 1 request
- Retries on network error
- Refetches when window regains focus

---

## Query Keys

The `queryKey` is the cache key. Same key = same cache entry, shared across all components.

```typescript
// These all share the same cache entry
useQuery({ queryKey: ['deployment', '123'] })
useQuery({ queryKey: ['deployment', '123'] })

// This is a different entry
useQuery({ queryKey: ['deployment', '456'] })
```

Keys are arrays. Convention:
```typescript
['deployments']                    // the list
['deployments', id]                // a specific item
['deployments', id, 'logs']        // related resource
['deployments', { status: 'running' }]  // filtered list
```

---

## useQuery

```typescript
const {
  data,           // the fetched data (undefined while loading)
  isLoading,      // true on first fetch (no cached data yet)
  isFetching,     // true whenever a request is in flight (including refetches)
  isError,        // true if the last fetch failed
  error,          // the error object
  refetch,        // manually trigger a refetch
} = useQuery({
  queryKey: ['deployment', id],
  queryFn: async () => {
    const res = await fetch(`/api/deployments/${id}`)
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json() as Promise<Deployment>
  },
  
  // Options
  staleTime: 1000 * 30,       // data is fresh for 30s, no refetch during this window
  refetchInterval: 3000,       // refetch every 3s (null disables)
  enabled: !!id,               // only run if id is truthy
  retry: 2,                    // retry failed requests 2 times
  select: (data) => data.logs, // transform data before returning to component
})
```

---

## Polling for Deployment Status

The deployment status changes over time (`pending → building → running`). We want the UI to stay in sync without the user refreshing.

```typescript
function useDeploymentStatus(id: string) {
  return useQuery({
    queryKey: ['deployment', id],
    queryFn: () => fetchDeployment(id),
    // Poll every 2s, but stop when deployment is done
    refetchInterval: (query) => {
      const status = query.state.data?.status
      const isTerminal = status === 'running' || status === 'failed'
      return isTerminal ? false : 2000
    },
  })
}
```

`refetchInterval` can be a function that receives the current query state — so we can stop polling once the deployment reaches a terminal state.

---

## useMutation

For writes (POST, PUT, DELETE). Unlike queries, mutations don't run automatically.

```typescript
const createDeployment = useMutation({
  mutationFn: (gitUrl: string) =>
    fetch('/api/deployments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gitUrl }),
    }).then(res => res.json()),

  onSuccess: (newDeployment) => {
    // Invalidate the deployments list so it refetches
    queryClient.invalidateQueries({ queryKey: ['deployments'] })
    
    // Or directly update the cache with the new item
    queryClient.setQueryData(
      ['deployment', newDeployment.id],
      newDeployment
    )
    
    // Navigate to the new deployment
    navigate({ to: '/deployments/$id', params: { id: newDeployment.id } })
  },

  onError: (error) => {
    toast.error(error.message)
  },
})

// Trigger it
<button
  onClick={() => createDeployment.mutate(gitUrl)}
  disabled={createDeployment.isPending}
>
  {createDeployment.isPending ? 'Deploying...' : 'Deploy'}
</button>
```

---

## Cache Invalidation

When you modify data on the server, you need to update the cache so the UI reflects the change.

```typescript
const queryClient = useQueryClient()

// Option 1: Invalidate — mark as stale, refetch immediately
queryClient.invalidateQueries({ queryKey: ['deployments'] })

// Option 2: Directly set cache data (optimistic update)
queryClient.setQueryData(['deployment', id], updatedDeployment)

// Option 3: Prefetch — load data before user navigates there
queryClient.prefetchQuery({
  queryKey: ['deployment', id],
  queryFn: () => fetchDeployment(id),
})
```

---

## QueryClient Setup

Wire it into your app once:

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,    // default: data is fresh for 1 minute
      retry: 2,                // retry failed requests twice
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)
```

---

## TanStack Query Devtools

Add this to see the cache in your browser:

```bash
npm install @tanstack/react-query-devtools
```

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Inside QueryClientProvider
<ReactQueryDevtools initialIsOpen={false} />
```

Shows all queries, their state, data, and lets you manually refetch or invalidate. Invaluable during development.

---

## How We Use It in This Project

| Data | Strategy |
|------|----------|
| List of all deployments | `useQuery` with `staleTime: 30s` |
| Single deployment status | `useQuery` with `refetchInterval` (stops when terminal state) |
| Create deployment | `useMutation` → invalidate deployments list |
| Stop deployment | `useMutation` → update specific deployment in cache |

Build logs come via SSE (not TanStack Query) since they're a stream, not a request/response.

---

## What to Remember

- TanStack Query manages **server state** — async data that lives on a server
- `queryKey` is the cache key — same key across components = shared cache, 1 request
- `useQuery` for reads, `useMutation` for writes
- `refetchInterval` for polling — can be a function to stop polling dynamically
- `invalidateQueries` after mutations to keep the UI in sync
- `staleTime` controls how long before a cached result is considered stale
