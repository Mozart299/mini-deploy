import type { DeploymentStatus } from '../types'

// Maps each deployment status to a display label and color class
const STATUS_CONFIG: Record<DeploymentStatus, { label: string; color: string; pulse: boolean }> = {
  pending:   { label: 'Queued',      color: '#6b7280', pulse: false },
  building:  { label: 'Building...', color: '#f59e0b', pulse: true  },
  deploying: { label: 'Deploying...', color: '#3b82f6', pulse: true  },
  running:   { label: 'Live',        color: '#22c55e', pulse: false },
  failed:    { label: 'Failed',      color: '#ef4444', pulse: false },
  stopped:   { label: 'Stopped',     color: '#6b7280', pulse: false },
}

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const { label, color, pulse } = STATUS_CONFIG[status]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        animation: pulse ? 'pulse 1.5s infinite' : 'none',
      }} />
      {label}
    </span>
  )
}
