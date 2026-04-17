import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Safety timeout - never stay loading more than 5s
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    // Check for existing session - use getSession() (local) to avoid network hangs
    const checkSession = async () => {
      try {
        // First get local session
        let { data: { session }, error: sessionError } = await supabase.auth.getSession()

        // Try to refresh the token to get updated user_metadata (non-blocking)
        if (session) {
          try {
            const refreshResult = await Promise.race([
              supabase.auth.refreshSession(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
            ])
            if (refreshResult && 'data' in refreshResult && refreshResult.data?.session) {
              session = refreshResult.data.session
              console.log('[Auth] Token refreshed, metadata updated')
            }
          } catch {
            console.warn('[Auth] Token refresh failed, using cached session')
          }
        }

        if (sessionError || !session) {
          if (mounted) {
            setUser(null)
            setProfile(null)
          }
        } else if (mounted) {
          setUser(session.user)
          // Set immediate fallback profile from JWT metadata (synced from profiles table)
          const meta = session.user.user_metadata || {}
          setProfile({
            id: session.user.id,
            email: session.user.email || '',
            full_name: meta.full_name || session.user.email?.split('@')[0] || '',
            role: (meta.role === 'super_admin' ? 'super_admin' : 'editor'),
          })
          console.log('[Auth] JWT fallback profile:', meta.full_name, meta.role)
          // Then try to fetch full profile from DB (may fail silently)
          fetchUserProfile(session.user.id, session.access_token)
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkSession()

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        const meta = session.user.user_metadata || {}
        setProfile({
          id: session.user.id,
          email: session.user.email || '',
          full_name: meta.full_name || session.user.email?.split('@')[0] || '',
          role: (meta.role === 'super_admin' ? 'super_admin' : 'editor'),
        })
        fetchUserProfile(session.user.id, session.access_token)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription?.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (userId: string, accessToken?: string) => {
    try {
      let token = accessToken
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token
      }
      if (!token) return

      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 6000)

      console.log('[Auth] Fetching profile for', userId)
      const resp = await fetch(
        `https://lqgdrkwabcjrnnthlrmi.supabase.co/rest/v1/profiles?select=id,email,full_name,role,avatar_url&id=eq.${userId}`,
        {
          signal: controller.signal,
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      )
      clearTimeout(t)

      console.log('[Auth] Profile response:', resp.status)
      if (!resp.ok) throw new Error(`Profile fetch failed: ${resp.status}`)
      const rows = await resp.json()
      console.log('[Auth] Profile data:', rows.length, 'rows')
      if (rows.length > 0) {
        setProfile(rows[0] as UserProfile)
      }
    } catch (error) {
      // Don't null the profile — keep the fallback from JWT
      console.warn('[Auth] Could not fetch full profile:', error)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    // Clear state immediately so the UI responds instantly
    setUser(null)
    setProfile(null)
    // Clear localStorage manually in case signOut() hangs
    try {
      const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (storageKey) localStorage.removeItem(storageKey)
    } catch { /* ignore */ }
    // Try to notify the server but don't block on it
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
    } catch {
      // If signOut fails/times out, session is already cleared locally
      console.warn('Server signOut timed out, session cleared locally')
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
