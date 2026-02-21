import { supabase } from './supabase'

const SESSION_KEY = 'dashboard_session'
const SESSION_EXPIRY_DAYS = 7
const PERMISSIONS_KEY = 'dashboard_access_permissions'

// --- Session management ---

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

// --- Dashboard permissions ---

// All dashboards with their route paths
export const ALL_DASHBOARDS = [
  { key: 'production', label: 'Production', path: '/danny' },
  { key: 'executive', label: 'Executive', path: '/bruce' },
  { key: 'financial', label: 'Financial', path: '/doron' },
  { key: 'coordinator', label: 'Coordinator', path: '/coordinator' },
  { key: 'admin', label: 'Admin', path: '/admin' },
]

export function getDashboardPermissions() {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveDashboardPermissions(permissions) {
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions))
}

// Get allowed dashboard keys for a specific user
export function getUserAllowedDashboards(user) {
  if (!user) return []

  const perms = getDashboardPermissions()

  // If permissions are configured for this user, use them
  if (perms && perms[user.id]) {
    return perms[user.id]
  }

  // Fall back to role-based defaults
  if (user.role === 'admin') {
    return ALL_DASHBOARDS.map((d) => d.key)
  }
  if (user.role === 'coordinator') {
    return ['coordinator']
  }
  return []
}

// Check if a user can access a specific path
export function canAccessPath(user, path) {
  const allowed = getUserAllowedDashboards(user)
  const dashboard = ALL_DASHBOARDS.find((d) => path.startsWith(d.path))
  if (!dashboard) return true // non-dashboard routes (gallery, login) always accessible
  return allowed.includes(dashboard.key)
}

// Get the first allowed dashboard path for a user (for redirects)
export function getDefaultPath(user) {
  const allowed = getUserAllowedDashboards(user)
  if (allowed.length === 0) return '/login'
  const first = ALL_DASHBOARDS.find((d) => allowed.includes(d.key))
  return first ? first.path : '/login'
}

// Legacy: Map CM roles to dashboard routes (fallback)
export function getRolePath(role) {
  switch (role) {
    case 'admin': return '/bruce'
    case 'coordinator': return '/coordinator'
    default: return '/danny'
  }
}
