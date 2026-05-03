import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthState {
  token: string | null
  role: string | null
  email: string | null
}

interface AuthContextValue extends AuthState {
  login: (token: string) => void
  logout: () => void
  isAuthenticated: boolean
  isReviewer: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function decodeToken(token: string): { role?: string; email?: string; sub?: string } {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

function loadFromStorage(): AuthState {
  const token = localStorage.getItem('rcm_token')
  if (!token) return { token: null, role: null, email: null }
  const decoded = decodeToken(token)
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('rcm_token')
    return { token: null, role: null, email: null }
  }
  return { token, role: decoded.role ?? null, email: decoded.email ?? decoded.sub ?? null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadFromStorage)

  const login = useCallback((token: string) => {
    localStorage.setItem('rcm_token', token)
    const decoded = decodeToken(token)
    setAuth({ token, role: decoded.role ?? null, email: decoded.email ?? decoded.sub ?? null })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('rcm_token')
    setAuth({ token: null, role: null, email: null })
  }, [])

  const value: AuthContextValue = {
    ...auth,
    login,
    logout,
    isAuthenticated: !!auth.token,
    isReviewer: auth.role === 'reviewer' || auth.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
