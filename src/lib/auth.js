import { supabase } from './supabase'

const SESSION_KEY = 'dashboard_session'
const SESSION_EXPIRY_DAYS = 7

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw)
    const elapsed = Date.now() - session.timestamp
    if (elapsed > SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session.user
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    user,
    timestamp: Date.now(),
  }))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function login(pin) {
  const { data, error } = await supabase.rpc('authenticate_cm', {
    pin_input: pin,
  })

  if (error) throw error
  if (!data) return null

  if (data.role !== 'admin' && data.role !== 'coordinator') {
    return { access_denied: true }
  }

  saveSession(data)
  return data
}

// Map CM roles to dashboard routes
export function getRolePath(role) {
  switch (role) {
    case 'admin': return '/bruce'
    case 'coordinator': return '/coordinator'
    default: return '/danny'
  }
}
