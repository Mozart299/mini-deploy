import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import { getDeployment, stopDeployment } from '../api/deployments'
import { useDeploymentLogs } from '../hooks/useDeploymentLogs'
import { StatusBadge } from '../components/StatusBadge'
import { LogViewer } from '../components/LogViewer'

export function DeploymentDetailPage() {
  // useParams() returns { id: string } — typed by the route definition
  const { id } = useParams({ from: '/deployments/$id' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Poll deployment status every 2s, stop when in a terminal state
  // See docs/07-tanstack-query.md for refetchInterval
  const { data: deployment } = useQuery({
    queryKey: ['deployment', id],
    queryFn: () => getDeployment(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      const isTerminal = status === 'running' || status === 'failed' || status === 'stopped'
      return isTerminal ? false : 2000
    },
  })

  // SSE hook — streams live build logs from the backend
  // See docs/05-sse.md for how this works
  const { logs } = useDeploymentLogs(id)

  const stop = useMutation({
    mutationFn: () => stopDeployment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', id] })
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
    },
  })

  if (!deployment) return <p style={{ color: '#8b949e' }}>Loading...</p>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <button
            onClick={() => navigate({ to: '/' })}
            style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '0.875rem', padding: 0, marginBottom: 8 }}
          >
            ← All Deployments
          </button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            {deployment.gitUrl.replace('https://github.com/', '')}
          </h1>
          <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '4px 0 0' }}>
            ID: {deployment.id}
          </p>
        </div>
        <StatusBadge status={deployment.status} />
      </div>

      {/* Live URL */}
      {deployment.url && (
        <div style={{
          background: '#161b22',
          border: '1px solid #238636',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.875rem', color: '#8b949e' }}>Live URL</span>
          <a href={deployment.url} target="_blank" rel="noreferrer" style={{ color: '#58a6ff', fontSize: '0.875rem' }}>
            {deployment.url}
          </a>
        </div>
      )}

      {/* Error */}
      {deployment.error && (
        <div style={{
          background: '#ff000011',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          color: '#ef4444',
          fontSize: '0.875rem',
        }}>
          {deployment.error}
        </div>
      )}

      {/* Build Logs */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '0.9rem', color: '#8b949e', marginBottom: 8, fontWeight: 500 }}>Build Logs</h2>
        {/* LogViewer renders lines streamed in real time via SSE */}
        <LogViewer logs={logs.length > 0 ? logs : deployment.logs} />
      </div>

      {/* Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 24,
      }}>
        <Detail label="Created" value={new Date(deployment.createdAt).toLocaleString()} />
        <Detail label="Updated" value={new Date(deployment.updatedAt).toLocaleString()} />
        <Detail label="Git URL" value={deployment.gitUrl} />
        {deployment.port && <Detail label="Container Port" value={String(deployment.port)} />}
      </div>

      {/* Stop button — only shown when running */}
      {deployment.status === 'running' && (
        <button
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
          style={{
            background: 'transparent',
            border: '1px solid #ef4444',
            color: '#ef4444',
            borderRadius: 6,
            padding: '6px 16px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {stop.isPending ? 'Stopping...' : 'Stop Deployment'}
        </button>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 6, padding: '10px 14px' }}>
      <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}
