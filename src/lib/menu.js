// Every admin page, and which roles can see it.
// Roles come from admin_accounts.role: 'super_admin', 'staff_admin', 'field_staff'.
// To hide or show a page for a role, only change this list.
// `group: 'manage'` puts the item under the "Manage" heading in the menu.
export const MENU = [
  { path: '/',              label: 'Today',               roles: ['super_admin', 'staff_admin'] },
  { path: '/bookings',      label: 'Bookings',            roles: ['super_admin', 'staff_admin'] },
  { path: '/walk-in',       label: 'New booking',         roles: ['super_admin', 'staff_admin'] },
  { path: '/payments',      label: 'GCash checks',        roles: ['super_admin', 'staff_admin'] },
  { path: '/cancellations', label: 'Requests',            roles: ['super_admin', 'staff_admin'], group: 'manage' },
  { path: '/date-controls', label: 'Calendar & closures', roles: ['super_admin', 'staff_admin'], group: 'manage' },
  { path: '/activities',    label: 'Areas & prices',      roles: ['super_admin', 'staff_admin'], group: 'manage' },
  { path: '/staff',         label: 'Staff',               roles: ['super_admin'], group: 'manage' },
  { path: '/analytics',     label: 'Reports',             roles: ['super_admin', 'staff_admin'], group: 'manage' },
  { path: '/my-groups',     label: "Today's groups",      roles: ['field_staff'] },
]

export const ROLE_NAMES = {
  super_admin: 'Super Admin',
  staff_admin: 'Staff Admin',
  field_staff: 'Field Staff',
}

// The menu items one role is allowed to see.
export function menuFor(role) {
  return MENU.filter((item) => item.roles.includes(role))
}
