// One shared connection to Supabase for the whole app.
// Every page imports `supabase` from here instead of creating its own.
//
// The two settings come from Vercel (Project → Settings → Environment Variables) or a local .env file:
//   VITE_SUPABASE_URL              e.g. https://xxxx.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY  the publishable (anon) key, safe for the browser
// Never put the service_role / secret key here.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// false until both settings exist; App.jsx then shows a "not connected yet" page instead of crashing.
export const isConnected = Boolean(url && key && !url.includes('YOUR-PROJECT-ID'))

export const supabase = isConnected ? createClient(url, key) : null
