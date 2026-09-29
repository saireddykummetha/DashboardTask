import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, clearTokens, setTokens } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = async (email, password) => {
    const tokens = await authApi.login({ email, password })
    setTokens(tokens.access_token, tokens.refresh_token)
    const me = await authApi.me()
    setUser(me)
    return me
  }

  const register = async (name, email, password) => {
    // Create account only — user must sign in afterwards
    await authApi.register({ name, email, password })
    clearTokens()
    setUser(null)
  }

  const logout = () => {
    clearTokens()
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isAuthenticated: !!user }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
