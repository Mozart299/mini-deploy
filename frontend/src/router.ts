import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { RootLayout } from './layouts/RootLayout'
import { DeploymentsPage } from './routes/DeploymentsPage'
import { DeploymentDetailPage } from './routes/DeploymentDetailPage'
import { NewDeploymentPage } from './routes/NewDeploymentPage'

// Route tree — maps URL patterns to components
// See docs/06-tanstack-router.md for a full explanation

const rootRoute = createRootRoute({ component: RootLayout })

const deploymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DeploymentsPage,
})

const newDeploymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/new',
  component: NewDeploymentPage,
})

// $id is a dynamic segment — Route.useParams() returns { id: string }
export const deploymentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deployments/$id',
  component: DeploymentDetailPage,
})

const routeTree = rootRoute.addChildren([
  deploymentsRoute,
  newDeploymentRoute,
  deploymentDetailRoute,
])

export const router = createRouter({ routeTree })

// Type registration — makes useRouter() and Link fully typed
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
