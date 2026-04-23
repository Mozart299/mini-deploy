import { Outlet, Link } from '@tanstack/react-router'

// RootLayout wraps every page. <Outlet /> renders the active child route.
// See docs/06-tanstack-router.md for how Outlet works.
export function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{
        borderBottom: '1px solid #21262d',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        height: 56,
      }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: '1rem', color: '#e6edf3', textDecoration: 'none' }}>
          mini-deploy
        </Link>
        <Link to="/new" style={{ fontSize: '0.875rem', color: '#8b949e', textDecoration: 'none' }}>
          + New Deployment
        </Link>
      </nav>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <Outlet />
      </main>
    </div>
  )
}
