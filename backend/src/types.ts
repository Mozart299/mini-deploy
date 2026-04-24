export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'deploying'
  | 'running'
  | 'failed'
  | 'stopped'

export interface Deployment {
  id: string
  gitUrl: string
  status: DeploymentStatus
  port?: number
  url?: string
  error?: string
  logs: string[]
  createdAt: Date
  updatedAt: Date
}

// Valid state transitions — prevents nonsensical jumps
export const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  pending:   ['building', 'failed', 'stopped'],
  building:  ['deploying', 'failed', 'stopped'],
  deploying: ['running', 'failed', 'stopped'],
  running:   ['stopped', 'failed'],
  failed:    [],
  stopped:   [],
}
