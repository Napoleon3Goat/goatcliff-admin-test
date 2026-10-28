// One shared connection to Supabase for the whole app.
// Every page imports `supabase` from here instead of creating its own.
//
// No Supabase settings (no .env, or the GitHub Pages build without variables)?
// Then the site runs in DEMO MODE with made-up data, so it can be shown safely.
import { createClient } from '@supabase/supabase-js'
import { createClient as createDemoClient } from './demoClient'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isDemo = !url || !key || url.includes('YOUR-PROJECT-ID')

export const supabase = isDemo ? createDemoClient() : createClient(url, key)
