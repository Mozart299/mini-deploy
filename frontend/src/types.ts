// Shared types — kept in sync with backend/src/types.ts manually
// In a monorepo you'd share these via a package

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
  createdAt: string
  updatedAt: string
}
