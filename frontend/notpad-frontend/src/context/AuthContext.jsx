import { useState } from 'react'
import { apiClient } from '../services/api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const userId = sessionStorage.getItem('user_id')
    return userId ? { user_id: userId } : null
  })
  const [error, setError] = useState(null)

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
    <AuthContext.Provider value={{ user, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
