import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { createDeployment } from '../api/deployments'

// useMutation handles the POST request.
// On success: invalidate the deployments list cache + navigate to the detail page.
// See docs/07-tanstack-query.md for mutations.
export function NewDeploymentPage() {
  const [gitUrl, setGitUrl] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const deploy = useMutation({
    mutationFn: () => createDeployment(gitUrl),
    onSuccess: (deployment) => {
      // Tell TanStack Query the deployments list is stale — it will refetch
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
      // Navigate to the detail page for the new deployment
      navigate({ to: '/deployments/$id', params: { id: deployment.id } })
    },
  })

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 24 }}>New Deployment</h1>

      <label style={{ display: 'block', fontSize: '0.875rem', color: '#8b949e', marginBottom: 8 }}>
        Git URL
      </label>
      <input
        type="text"
        placeholder="https://github.com/user/repo"
        value={gitUrl}
        onChange={e => setGitUrl(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 6,
          color: '#e6edf3',
          fontSize: '0.9rem',
          boxSizing: 'border-box',
          marginBottom: 16,
        }}
      />

      {deploy.isError && (
        <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 12 }}>
          {deploy.error instanceof Error ? deploy.error.message : 'Something went wrong'}
        </p>
      )}

      <button
        onClick={() => deploy.mutate()}
        disabled={!gitUrl || deploy.isPending}
        style={{
          background: deploy.isPending ? '#238636aa' : '#238636',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 20px',
          fontSize: '0.9rem',
          cursor: deploy.isPending ? 'not-allowed' : 'pointer',
          fontWeight: 500,
        }}
      >
        {deploy.isPending ? 'Deploying...' : 'Deploy'}
      </button>
    </div>
  )
}
