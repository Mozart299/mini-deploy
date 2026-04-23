import { useEffect, useRef } from 'react'

interface LogViewerProps {
  logs: string[]
}

// Renders a terminal-style log output that auto-scrolls to the bottom
// as new lines arrive from the SSE stream
export function LogViewer({ logs }: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll whenever logs array grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div style={{
      background: '#0d1117',
      color: '#e6edf3',
      fontFamily: 'monospace',
      fontSize: '0.8rem',
      padding: '16px',
      borderRadius: '8px',
      height: '360px',
      overflowY: 'auto',
      lineHeight: 1.6,
    }}>
      {logs.length === 0 ? (
        <span style={{ color: '#6e7681' }}>Waiting for logs...</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{ color: '#6e7681', userSelect: 'none', marginRight: 8 }}>
              {String(i + 1).padStart(3, ' ')}
            </span>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
