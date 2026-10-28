import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { menuFor, ROLE_NAMES } from '../lib/menu'
import logo from '../assets/logo-white.png'

// The frame around every admin page: the pine-green menu rail on the left, the page on the right.
// <Outlet /> is where the current page (Bookings, GCash checks, ...) appears.
// Field Staff have one page only, so they get a simple top bar instead of a menu.
export default function AdminLayout({ admin }) {
  const [menuOpen, setMenuOpen] = useState(false) // phones: the menu is hidden until tapped
  const items = menuFor(admin.role)
  const main = items.filter((i) => !i.group)
  const manage = items.filter((i) => i.group === 'manage')
  const single = items.length === 1

  const link = (item) => (
    <NavLink key={item.path} to={item.path} end={item.path === '/'}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
      onClick={() => setMenuOpen(false)}>
      {item.label}
    </NavLink>
  )

  return (
    <div className={single ? 'layout layout-single' : 'layout'}>
      <header className="topbar">
        <span className="brand"><img src={logo} alt="" className="brand-logo" /><span className="wordmark">Goatcliff</span></span>
        {single
          ? <button className="topbar-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
          : <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="admin-menu">
              {menuOpen ? 'Close' : 'Menu'}
            </button>}
      </header>

      {!single && (
        <aside id="admin-menu" className={menuOpen ? 'rail open' : 'rail'}>
          <div className="rail-brand">
            <span className="brand"><img src={logo} alt="" className="brand-logo" /><span className="wordmark">Goatcliff</span></span>
            <span className="rail-sub">{admin.role === 'field_staff' ? 'Field staff' : 'Front desk'}</span>
          </div>
          <nav aria-label="Admin pages">
            {main.map(link)}
            {manage.length > 0 && <p className="rail-group">Manage</p>}
            {manage.map(link)}
          </nav>
          <div className="rail-footer">
            <strong>{admin.name}</strong>
            <span>{ROLE_NAMES[admin.role]}</span>
            <button className="rail-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </aside>
      )}

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
