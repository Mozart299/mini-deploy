import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import { getDeployment, stopDeployment, purgeDeployment } from '../api/deployments'
import { useDeploymentLogs } from '../hooks/useDeploymentLogs'
import { StatusBadge } from '../components/StatusBadge'
import { LogViewer } from '../components/LogViewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function DeploymentDetailPage() {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { id } = useParams({ from: '/deployments/$id' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: deployment } = useQuery({
    queryKey: ['deployment', id],
    queryFn: () => getDeployment(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      const isTerminal = status === 'running' || status === 'failed' || status === 'stopped'
      return isTerminal ? false : 2000
    },
  })

  const { logs } = useDeploymentLogs(id)

  const stop = useMutation({
    mutationFn: () => stopDeployment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', id] })
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
    },
  })

  const purge = useMutation({
    mutationFn: () => purgeDeployment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
      navigate({ to: '/' })
    },
  })

  if (!deployment) {
    return <div className="h-48 rounded-lg bg-muted animate-pulse" />
  }

  const repoName = deployment.gitUrl.replace('https://github.com/', '').replace(/\.git$/, '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ to: '/' })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1"
          >
            ← All deployments
          </button>
          <h1 className="font-semibold text-lg">{repoName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">ID: {deployment.id}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={deployment.status} />
          {['pending', 'building', 'deploying'].includes(deployment.status) && (
            <Button variant="outline" size="sm" onClick={() => stop.mutate()} disabled={stop.isPending}>
              {stop.isPending ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          {deployment.status === 'running' && (
            <Button variant="destructive" size="sm" onClick={() => stop.mutate()} disabled={stop.isPending}>
              {stop.isPending ? 'Stopping...' : 'Stop'}
            </Button>
          )}
          {['failed', 'stopped'].includes(deployment.status) && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Live URL */}
      {deployment.url && (
        <Card className="border-emerald-800/50 bg-emerald-950/20">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Live URL</span>
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-400 hover:underline"
            >
              {deployment.url}
            </a>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {deployment.error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-3 px-4">
            <p className="text-sm text-destructive">{deployment.error}</p>
          </CardContent>
        </Card>
      )}

      <DeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => purge.mutate()}
        pending={purge.isPending}
      />

      {/* Build Logs */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Build Logs</h2>
        <LogViewer logs={logs.length > 0 ? logs : deployment.logs} />
      </div>

      {/* Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Detail label="Created" value={new Date(deployment.createdAt).toLocaleString()} />
          <Detail label="Updated" value={new Date(deployment.updatedAt).toLocaleString()} />
          <Detail label="Git URL" value={deployment.gitUrl} />
          {deployment.port && <Detail label="Port" value={String(deployment.port)} />}
        </CardContent>
      </Card>
    </div>
  )
}

function DeleteDialog({ open, onClose, onConfirm, pending }: { open: boolean; onClose: () => void; onConfirm: () => void; pending: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete deployment?</DialogTitle>
          <DialogDescription>
            This permanently removes the deployment record. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Deleting...' : 'Yes, delete it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm break-all">{value}</p>
    </div>
  )
}
