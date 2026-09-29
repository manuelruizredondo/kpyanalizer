import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
import { LAST_CSS_STORAGE_KEY } from '@/lib/storage-keys'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'editor'
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Perfil provisional a partir del JWT mientras llega el de la tabla profiles.
// Ojo: user_metadata lo puede editar el propio usuario, así que el rol de aquí
// es solo orientativo (la BD es la que manda vía RLS).
function profileFromSession(session: Session): UserProfile {
  const meta = session.user.user_metadata || {}
  return {
    id: session.user.id,
    email: session.user.email || '',
    full_name: meta.full_name || session.user.email?.split('@')[0] || '',
    role: meta.role === 'super_admin' ? 'super_admin' : 'editor',
  }
}

function clearLocalAuthState() {
  try {
    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (storageKey) localStorage.removeItem(storageKey)
  } catch { /* ignore */ }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  // Usuario vigente: descarta respuestas de perfil que lleguen tras un logout
  // o un cambio de cuenta.
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Red de seguridad: nunca quedarse en "Cargando..." para siempre.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    const fetchUserProfile = async (userId: string, accessToken: string) => {
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 6000)
        try {
          const resp = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name,role,avatar_url&id=eq.${userId}`,
            {
              signal: controller.signal,
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          )
          if (!resp.ok) throw new Error(`Profile fetch failed: ${resp.status}`)
          const rows = (await resp.json()) as UserProfile[]
          if (mounted && rows.length > 0 && currentUserIdRef.current === userId) {
            setProfile(rows[0])
          }
        } finally {
          clearTimeout(t)
        }
      } catch (error) {
        // Se mantiene el perfil provisional del JWT.
        console.warn('[Auth] Could not fetch full profile:', error)
      }
    }

    // INITIAL_SESSION llega con la sesión ya recuperada (y refrescada si había
    // caducado). Si el refresh token fue revocado en otro sitio, llega null:
    // así no se "resucita" una sesión muerta desde la caché local.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (!session?.user) {
        currentUserIdRef.current = null
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      const userChanged = currentUserIdRef.current !== session.user.id
      currentUserIdRef.current = session.user.id
      setUser(session.user)

      // TOKEN_REFRESHED (cada hora) no debe pisar el perfil real de la BD con
      // el provisional del JWT ni volver a pedirlo.
      if (userChanged || event === 'USER_UPDATED') {
        if (userChanged) setProfile(profileFromSession(session))
        // Sin await: no se debe esperar a otras llamadas dentro del callback.
        void fetchUserProfile(session.user.id, session.access_token)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    // La UI responde al instante; la revocación sigue en segundo plano.
    currentUserIdRef.current = null
    setUser(null)
    setProfile(null)
    // El último CSS pegado no debe verlo el siguiente usuario de esta pestaña.
    try { sessionStorage.removeItem(LAST_CSS_STORAGE_KEY) } catch { /* ignore */ }

    // Primero signOut() (necesita leer la sesión guardada para revocar el
    // refresh token en el servidor); solo si falla o se cuelga se borra a mano.
    // scope 'local': cierra esta sesión sin echar al usuario de otros equipos.
    try {
      const { error } = await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
      if (error) throw error
    } catch {
      console.warn('Server signOut failed or timed out, clearing session locally')
      clearLocalAuthState()
    }
  }

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
