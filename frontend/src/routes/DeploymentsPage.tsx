import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { listDeployments } from '../api/deployments'
import { StatusBadge } from '../components/StatusBadge'
import type { Deployment } from '../types'

// useQuery fetches + caches the deployments list.
// refetchInterval polls every 3s so status updates appear automatically.
// See docs/07-tanstack-query.md for full explanation.
export function DeploymentsPage() {
  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: listDeployments,
    refetchInterval: 3000,
  })

  if (isLoading) return <p style={{ color: '#8b949e' }}>Loading...</p>

  if (deployments.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: 80, color: '#8b949e' }}>
        <p style={{ fontSize: '1.1rem' }}>No deployments yet.</p>
        <Link to="/new" style={{ color: '#58a6ff' }}>Create your first deployment →</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Deployments</h1>
        <Link to="/new" style={{
          background: '#238636',
          color: '#fff',
          padding: '6px 16px',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: '0.875rem',
        }}>
          New
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deployments.map((d: Deployment) => (
          <DeploymentRow key={d.id} deployment={d} />
        ))}
      </div>
    </div>
  )
}

function DeploymentRow({ deployment: d }: { deployment: Deployment }) {
  return (
    <Link
      to="/deployments/$id"
      params={{ id: d.id }}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        border: '1px solid #21262d',
        borderRadius: 8,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#388bfd')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#21262d')}
      >
        <div>
          <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
            {d.gitUrl.replace('https://github.com/', '')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
            {d.id} · {new Date(d.createdAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.75rem', color: '#58a6ff' }}
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
