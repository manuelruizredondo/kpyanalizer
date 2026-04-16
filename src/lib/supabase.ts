import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lqgdrkwabcjrnnthlrmi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2Rya3dhYmNqcm5udGhscm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzIzMTQsImV4cCI6MjA5MTkwODMxNH0.0qhUexm2vPc-wDnX-G7w5Gg82Y2_Jow_v-9kWqL29AQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
