import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { menuFor } from './lib/menu'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bookings from './pages/Bookings'
import BookingDetail from './pages/BookingDetail'
import WalkIn from './pages/WalkIn'
import VerifyPayments from './pages/VerifyPayments'
import Cancellations from './pages/Cancellations'
import DateControls from './pages/DateControls'
import Activities from './pages/Activities'
import StaffAccounts from './pages/StaffAccounts'
import Analytics from './pages/Analytics'
import MyGroups from './pages/MyGroups'
import AdminLayout from './components/AdminLayout'

// Which page component goes with each menu path (see src/lib/menu.js for who sees what).
const PAGES = {
  '/': Dashboard,
  '/bookings': Bookings,
  '/walk-in': WalkIn,
  '/payments': VerifyPayments,
  '/cancellations': Cancellations,
  '/date-controls': DateControls,
  '/activities': Activities,
  '/staff': StaffAccounts,
  '/analytics': Analytics,
  '/my-groups': MyGroups,
}

export default function App() {
  // session = who is logged in (null = nobody). undefined = still checking.
  const [session, setSession] = useState(undefined)
  // admin = this person's row in admin_accounts (name, role, is_active).
  const [admin, setAdmin] = useState(null)
  const [adminError, setAdminError] = useState('')

  // 1. Track log-ins and log-outs.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // 2. When someone logs in, load their admin_accounts row to learn their role.
  useEffect(() => {
    setAdmin(null)
    setAdminError('')
    if (!session) return

    supabase
      .from('admin_accounts')
      .select('id, name, role, is_active')
      .eq('auth_user_id', session.user.id) // admin_accounts links to the login through auth_user_id
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setAdminError('Could not load your account. Check your connection and try again.')
        else if (!data) setAdminError('This login is not registered as a Goatcliff admin.')
        else if (!data.is_active) setAdminError('This admin account has been deactivated.')
        else setAdmin(data)
      })
  }, [session])

  if (session === undefined) return <div className="center-screen">Loading…</div>
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (adminError) {
    return (
      <div className="center-screen">
        <div className="card">
          <h1>Can't open the admin panel</h1>
          <p className="error">{adminError}</p>
          <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    )
  }
  if (!admin) return <div className="center-screen">Loading your account…</div>

  // 3. Only create routes for the pages this role may see. Anything else goes to their first page.
  const pages = menuFor(admin.role)
  const canSeeBookings = pages.some((p) => p.path === '/bookings')
  return (
    <Routes>
      <Route element={<AdminLayout admin={admin} />}>
        {pages.map((item) => {
          const Page = PAGES[item.path]
          return <Route key={item.path} path={item.path} element={<Page admin={admin} />} />
        })}
        {canSeeBookings && <Route path="/bookings/:id" element={<BookingDetail admin={admin} />} />}
        <Route path="*" element={<Navigate to={pages[0].path} replace />} />
      </Route>
    </Routes>
  )
}
