import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const { data } = await axios.post('/api/v1/auth/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      login(data.access_token)
      navigate('/admin')
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '40px 36px', width: 360, boxShadow: '0 4px 32px rgba(0,0,0,0.4)' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛣️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>Road Crack Monitor</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Admin Portal</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
              placeholder="admin@example.com"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: loading ? '#1d4ed8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '9px 12px',
  color: '#e2e8f0',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
}
