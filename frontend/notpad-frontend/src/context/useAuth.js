import { useAuthContext } from './auth-context'

export function useAuth() {
  const context = useAuthContext()
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
