import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { listDeployments } from '../api/deployments'
import { StatusBadge } from '../components/StatusBadge'
import type { Deployment } from '../types'

export function DeploymentsPage() {
  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: listDeployments,
    refetchInterval: 3000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="text-4xl">🚀</div>
        <div>
          <p className="font-medium">No deployments yet</p>
          <p className="text-sm text-muted-foreground mt-1">Deploy a Git repo to get started</p>
        </div>
        <Link to="/new" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm font-medium transition-colors">
          Create your first deployment
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Deployments</h1>
        <span className="text-sm text-muted-foreground">{deployments.length} total</span>
      </div>

      <div className="space-y-2">
        {deployments.map((d: Deployment) => (
          <DeploymentRow key={d.id} deployment={d} />
        ))}
      </div>
    </div>
  )
}

function DeploymentRow({ deployment: d }: { deployment: Deployment }) {
  const repoName = d.gitUrl.replace('https://github.com/', '').replace(/\.git$/, '')

  return (
    <Link to="/deployments/$id" params={{ id: d.id }} className="block">
      <div className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 hover:bg-accent/5 transition-colors">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{repoName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {d.id} · {new Date(d.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
              onClick={e => e.stopPropagation()}
            >
              {d.url}
            </a>
          )}
          <StatusBadge status={d.status} />
        </div>
      </div>
    </Link>
  )
}
