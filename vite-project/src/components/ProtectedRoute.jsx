import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p>Loading session…</p>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
