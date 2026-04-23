import { useEffect, useState } from 'react'
import type { DeploymentStatus } from '../types'

interface LogEvent {
  type: 'log' | 'status' | 'done' | 'error'
  line?: string
  status?: DeploymentStatus
  url?: string
  message?: string
}

interface UseDeploymentLogsResult {
  logs: string[]
  status: DeploymentStatus | null
  url: string | null
  done: boolean
}

// Custom hook that opens an SSE connection to stream live build logs.
// See docs/05-sse.md for how SSE works.
export function useDeploymentLogs(deploymentId: string): UseDeploymentLogsResult {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<DeploymentStatus | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // EventSource is the browser's built-in SSE client
    const source = new EventSource(`http://localhost:3001/deployments/${deploymentId}/logs`)

    source.onmessage = (event) => {
      const data: LogEvent = JSON.parse(event.data)

      if (data.type === 'log' && data.line) {
        setLogs(prev => [...prev, data.line!])
      }
      if (data.type === 'status' && data.status) {
        setStatus(data.status)
        if (data.url) setUrl(data.url)
      }
      if (data.type === 'done') {
        setDone(true)
        source.close()
      }
      if (data.type === 'error') {
        setLogs(prev => [...prev, `Error: ${data.message}`])
        setDone(true)
        source.close()
      }
    }

    source.onerror = () => {
      setDone(true)
      source.close()
    }

    // Cleanup: close connection when component unmounts
    return () => source.close()
  }, [deploymentId])

  return { logs, status, url, done }
}
