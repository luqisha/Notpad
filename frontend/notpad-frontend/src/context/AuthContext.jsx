import { createContext, useContext, useState, useEffect } from 'react'
import { apiClient } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check if user is already logged in (from session)
    const userId = sessionStorage.getItem('user_id')
    if (userId) {
      setUser({ user_id: userId })
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      setError(null)
      const response = await apiClient.login(email, password)
      setUser({ user_id: response.user_id })
      sessionStorage.setItem('user_id', response.user_id)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const register = async (email, password) => {
    try {
      setError(null)
      await apiClient.register(email, password)
      // After registration, login automatically
      return await login(email, password)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const logout = async () => {
    try {
      await apiClient.logout()
      setUser(null)
      sessionStorage.removeItem('user_id')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
