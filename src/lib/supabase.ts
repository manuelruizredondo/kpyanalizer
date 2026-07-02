import { createClient } from '@supabase/supabase-js'

// Fuente única de la config de Supabase. La clave `anon` es PÚBLICA por diseño
// (va en el bundle del cliente y está protegida por RLS), por eso es seguro
// tenerla como fallback. Se puede sobreescribir por entorno con
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sin tocar el código.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://lqgdrkwabcjrnnthlrmi.supabase.co'

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 0 } },
  global: {
    fetch: (...args) => fetch(...args),
  },
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
