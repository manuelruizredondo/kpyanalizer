import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/analyze', label: 'Analizar' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/action-plan', label: 'Auditoría CSS' },
]

interface EditorialHeaderProps {
  /** Optional second row content (tabs, selectors, etc.) rendered inside the sticky header */
  secondRow?: React.ReactNode
}

export function EditorialHeader({ secondRow }: EditorialHeaderProps) {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()

  const displayName =
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Usuario'

  const avatarInitial =
    profile?.full_name?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U'

  const roleLabel = profile?.role === 'super_admin' ? 'Admin' : 'Editor'

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl"
      style={{
        background: 'rgba(246, 247, 245, 0.85)',
        borderBottom: '1px solid rgba(11, 31, 22, 0.08)',
      }}
    >
      {/* Row 1: Brand + Nav + User */}
      <div className="px-8 pt-4 pb-3 flex items-center justify-between gap-6">
        {/* Left: Brand + Nav */}
        <div className="flex items-center gap-8">
          {/* K logo + kpy ANALYTICS */}
          <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#012d1d', color: '#e5f2ec', fontFamily: 'Fraunces, serif' }}
            >
              <span className="text-[15px] font-semibold leading-none">K</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: '#0b1f16', fontFamily: 'Fraunces, serif' }}
              >
                kpy
              </span>
              <span
                className="text-[11px] uppercase tracking-[0.14em]"
                style={{ color: '#52695b' }}
              >
                analytics
              </span>
            </div>
          </Link>

          {/* Vertical separator */}
          <div style={{ width: '1px', height: '24px', background: 'rgba(11, 31, 22, 0.08)' }} />

          {/* Section nav */}
          <nav className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="text-[13px] font-medium transition-colors no-underline"
                  style={{
                    color: active ? '#0b1f16' : '#52695b',
                    borderBottom: active ? '2px solid #006c48' : '2px solid transparent',
                    paddingBottom: '2px',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: User */}
        <div className="flex items-center gap-4">
          {/* Vertical separator */}
          <div style={{ width: '1px', height: '24px', background: 'rgba(11, 31, 22, 0.08)' }} />

          {/* User avatar + name + role */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ background: '#006c48' }}
            >
              {avatarInitial}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-medium text-[#0b1f16]">{displayName}</span>
              <span className="text-[10px] text-[#52695b]">{roleLabel}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="ml-2 p-1.5 rounded hover:bg-[#f0f2f1] transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={14} className="text-[#52695b]" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Optional page-specific content */}
      {secondRow && (
        <div
          className="px-8 flex items-center gap-1 overflow-x-auto border-t"
          style={{ borderColor: 'rgba(11, 31, 22, 0.08)' }}
        >
          {secondRow}
        </div>
      )}
    </header>
  )
}
