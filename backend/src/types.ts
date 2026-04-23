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
  pending:   ['building', 'failed'],
  building:  ['deploying', 'failed'],
  deploying: ['running', 'failed'],
  running:   ['stopped', 'failed'],
  failed:    [],
  stopped:   [],
}
