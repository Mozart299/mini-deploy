import { Badge } from '@/components/ui/badge'
import type { DeploymentStatus } from '../types'

const STATUS_CONFIG: Record<DeploymentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; pulse: boolean }> = {
  pending:   { label: 'Queued',       variant: 'secondary',    pulse: false },
  building:  { label: 'Building',     variant: 'outline',      pulse: true  },
  deploying: { label: 'Deploying',    variant: 'outline',      pulse: true  },
  running:   { label: 'Live',         variant: 'default',      pulse: false },
  failed:    { label: 'Failed',       variant: 'destructive',  pulse: false },
  stopped:   { label: 'Stopped',      variant: 'secondary',    pulse: false },
}

const PULSE_COLOR: Partial<Record<DeploymentStatus, string>> = {
  building:  'bg-amber-400',
  deploying: 'bg-blue-400',
}

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const { label, variant, pulse } = STATUS_CONFIG[status]

  return (
    <Badge variant={variant} className="gap-1.5">
      {pulse && (
        <span className={`size-1.5 rounded-full animate-pulse ${PULSE_COLOR[status] ?? 'bg-current'}`} />
      )}
      {status === 'running' && (
        <span className="size-1.5 rounded-full bg-emerald-400" />
      )}
      {label}
    </Badge>
  )
}
