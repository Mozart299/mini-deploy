import type { Deployment } from '../types'

const BASE = 'http://localhost:3001'

export async function listDeployments(): Promise<Deployment[]> {
  const res = await fetch(`${BASE}/deployments`)
  if (!res.ok) throw new Error('Failed to fetch deployments')
  return res.json()
}

export async function getDeployment(id: string): Promise<Deployment> {
  const res = await fetch(`${BASE}/deployments/${id}`)
  if (!res.ok) throw new Error('Deployment not found')
  return res.json()
}

export async function createDeployment(gitUrl: string): Promise<Deployment> {
  const res = await fetch(`${BASE}/deployments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gitUrl }),
  })
  if (!res.ok) throw new Error('Failed to create deployment')
  return res.json()
}

export async function stopDeployment(id: string): Promise<Deployment> {
  const res = await fetch(`${BASE}/deployments/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to stop deployment')
  return res.json()
}
