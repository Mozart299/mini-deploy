import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { createDeployment } from '../api/deployments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function NewDeploymentPage() {
  const [gitUrl, setGitUrl] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const deploy = useMutation({
    mutationFn: () => createDeployment(gitUrl),
    onSuccess: (deployment) => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
      navigate({ to: '/deployments/$id', params: { id: deployment.id } })
    },
  })

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">New Deployment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a public Git URL. We'll build and deploy it automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repository</CardTitle>
          <CardDescription>Must be a public GitHub, GitLab, or Bitbucket URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="git-url">Git URL</Label>
            <Input
              id="git-url"
              type="text"
              placeholder="https://github.com/user/repo"
              value={gitUrl}
              onChange={e => setGitUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gitUrl && !deploy.isPending && deploy.mutate()}
            />
          </div>

          {deploy.isError && (
            <p className="text-sm text-destructive">
              {deploy.error instanceof Error ? deploy.error.message : 'Something went wrong'}
            </p>
          )}

          <Button
            onClick={() => deploy.mutate()}
            disabled={!gitUrl || deploy.isPending}
            className="w-full"
          >
            {deploy.isPending ? 'Deploying...' : 'Deploy'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
