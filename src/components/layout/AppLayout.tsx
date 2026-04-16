import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Code } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code size={28} className="text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">
                KPY CSS Analyzer
              </h1>
            </div>

            <nav className="flex items-center gap-8">
              <Link
                to="/analyze"
                className={`text-sm font-medium transition-colors ${
                  isActive('/analyze')
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Analizar
              </Link>
              <Link
                to="/dashboard"
                className={`text-sm font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dashboard
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.full_name || profile?.email || 'Usuario'}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {profile?.role === 'super_admin' ? 'Admin' : 'Editor'}
                </Badge>
              </div>
              <button
                onClick={signOut}
                className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}
