import { Navigate } from 'react-router-dom'

// Wrap any admin page in this. If nobody is logged in, send them to /login.
export default function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}
