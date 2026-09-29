import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'

// Cada página se carga bajo demanda: el analizador (css-tree) y recharts solo
// se descargan cuando hacen falta, en lugar de ir todos en un único bundle.
const AnalyzePage = lazy(() => import('@/components/analyze/AnalyzePage'))
const DashboardPage = lazy(() =>
  import('@/components/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })),
)
const ActionPlanPage = lazy(() =>
  import('@/components/actionplan/ActionPlanPage').then(m => ({ default: m.ActionPlanPage })),
)

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status">
      <p className="text-sm text-[#52695b]">Cargando...</p>
    </div>
  )
}

function Page({ children }: { children: ReactNode }) {
  // key={pathname}: al navegar a otra página se reinicia el ErrorBoundary.
  const { pathname } = useLocation()
  return (
    <AppLayout>
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </ErrorBoundary>
    </AppLayout>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f6f7f5' }} role="status">
        <p className="text-[#52695b]">Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route path="/analyze" element={<Page><AnalyzePage /></Page>} />
      <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
      <Route path="/action-plan" element={<Page><ActionPlanPage /></Page>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
