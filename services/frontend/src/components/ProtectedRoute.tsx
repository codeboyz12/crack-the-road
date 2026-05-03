import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReviewer } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isReviewer) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 24 }}>⛔</div>
      <div style={{ fontSize: 16 }}>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>
      <div style={{ fontSize: 13, color: '#64748b' }}>ต้องการสิทธิ์ reviewer หรือ admin</div>
    </div>
  )
  return <>{children}</>
}
