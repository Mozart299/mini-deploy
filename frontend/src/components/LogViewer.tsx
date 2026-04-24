import { useEffect, useRef } from 'react'

interface LogViewerProps {
  logs: string[]
}

export function LogViewer({ logs }: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div className="rounded-lg border border-border bg-black/60 font-mono text-xs leading-relaxed h-80 overflow-y-auto p-4">
      {logs.length === 0 ? (
        <span className="text-muted-foreground">Waiting for logs...</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className="flex gap-3 whitespace-pre-wrap break-all">
            <span className="select-none text-muted-foreground/50 w-6 shrink-0 text-right">
              {i + 1}
            </span>
            <span>{line}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
