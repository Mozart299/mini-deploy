import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Separator } from '@/components/ui/separator'

export function RootLayout() {
  const { location } = useRouterState()
  const isNew = location.pathname === '/new'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold text-sm tracking-tight hover:text-foreground/80 transition-colors">
              mini-deploy
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Deployments
            </Link>
          </div>
          {!isNew && (
            <Link to="/new" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-sm font-medium transition-colors">
              New deployment
            </Link>
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
