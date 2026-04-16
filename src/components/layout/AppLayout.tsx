import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Code, LogOut } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-white/80 backdrop-blur-xl border-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code size={28} className="text-[#006c48]" />
              <h1 className="text-xl font-bold text-[#012d1d]">
                KPY CSS Analyzer
              </h1>
            </div>

            <nav className="flex items-center gap-8">
              <Link
                to="/analyze"
                className={`text-sm font-medium transition-colors ${
                  isActive('/analyze')
                    ? 'text-[#006c48]'
                    : 'text-[#3d5a4a] hover:text-[#1a2e23]'
                }`}
              >
                Analizar
              </Link>
              <Link
                to="/dashboard"
                className={`text-sm font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'text-[#006c48]'
                    : 'text-[#3d5a4a] hover:text-[#1a2e23]'
                }`}
              >
                Dashboard
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[#1a2e23]">
                {profile?.full_name || profile?.email || 'Usuario'}
              </p>
              <Badge className="bg-[#e0f5ec] text-[#012d1d]">
                {profile?.role === 'super_admin' ? 'Admin' : 'Editor'}
              </Badge>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-[#9e2b25] hover:bg-[#fde8e8] transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        {children}
      </main>
    </div>
  )
}
