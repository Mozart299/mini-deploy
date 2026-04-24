import { Deployment, DeploymentStatus, VALID_TRANSITIONS } from './types'

// In-memory store — no database needed for this project.
// A Map is enough: keys are deployment IDs, values are Deployment objects.
const deployments = new Map<string, Deployment>()

export function getDeployment(id: string): Deployment {
  const d = deployments.get(id)
  if (!d) throw new Error(`Deployment ${id} not found`)
  return d
}

export function listDeployments(): Deployment[] {
  return Array.from(deployments.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function saveDeployment(deployment: Deployment): void {
  deployments.set(deployment.id, deployment)
}

export function deleteDeployment(id: string): void {
  if (!deployments.has(id)) throw new Error(`Deployment ${id} not found`)
  deployments.delete(id)
}

export function appendLog(id: string, line: string): void {
  const d = getDeployment(id)
  deployments.set(id, { ...d, logs: [...d.logs, line], updatedAt: new Date() })
}

export function transition(id: string, newStatus: DeploymentStatus, extra?: Partial<Deployment>): Deployment {
  const d = getDeployment(id)
  const allowed = VALID_TRANSITIONS[d.status]

  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition: ${d.status} → ${newStatus}`)
  }

  const updated: Deployment = {
    ...d,
    ...extra,
    status: newStatus,
    updatedAt: new Date(),
  }
  deployments.set(id, updated)
  return updated
}
