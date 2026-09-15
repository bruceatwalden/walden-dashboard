import { supabase } from './supabase'

const SESSION_KEY = 'dashboard_session'
const SESSION_EXPIRY_DAYS = 7
const PERMISSIONS_KEY = 'dashboard_access_permissions'

// ⭐ STAFF SIGN-IN TICKET (2026-09-15). The Dashboard access page lists staff through the shared
// back end, which needs a sign-in ticket: the browser's own word for who is signed in can be
// copied by anyone. Kept under its OWN key — the login screen saves the session twice, and the
// second save would overwrite a ticket kept inside it.
const TICKET_KEY = 'dashboard_signin_ticket'
const BACKEND_URL = 'https://walden-backend.vercel.app'

/**
 * Ask the shared back end to check a PIN and issue a Dashboard sign-in ticket.
 * Resolves { token, userId }; throws an Error with a plain message and `.code`.
 */
export async function requestSignInTicket(pin) {
  let res
  try {
    res = await fetch(`${BACKEND_URL}/api/staff-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign-in', pin, app_id: 'dashboard' }),
    })
  } catch {
    const err = new Error('Your PIN could not be checked just now — check the connection and try again.')
    err.code = 'unavailable'
    throw err
  }
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.token && json.user?.id) return { token: json.token, userId: json.user.id }
  const err = new Error(res.status === 401 ? 'That PIN was not recognised.' : json.error || 'Your PIN could not be checked just now. Try again.')
  err.code = res.status === 401 ? 'not_recognised' : res.status === 429 ? 'too_many_tries' : 'unavailable'
  throw err
}

export function storeSignInTicket(token, userId) {
  try { localStorage.setItem(TICKET_KEY, JSON.stringify({ token, userId })) } catch { /* nothing to keep it in */ }
}

/** The ticket, only if it belongs to the person signed in now. */
export function getSignInTicket() {
  try {
    const t = JSON.parse(localStorage.getItem(TICKET_KEY) || 'null')
    const me = getSession()
    return t?.token && me?.id && t.userId === me.id ? t.token : null
  } catch {
    return null
  }
}

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

// Sign out. Also cancels the sign-in ticket on the server, best-effort.
export function clearSession() {
  let token = null
  try { token = JSON.parse(localStorage.getItem(TICKET_KEY) || 'null')?.token || null } catch { /* none */ }
  if (token) {
    fetch(`${BACKEND_URL}/api/staff-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign-out', actor_token: token }),
      keepalive: true,
    }).catch(() => { /* it still expires within seven days */ })
  }
  localStorage.removeItem(TICKET_KEY)
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
  // An admin also gets a sign-in ticket, in the background; sign-in never waits on it. If it does
  // not arrive, the Dashboard access page asks for the PIN once.
  if (data.id && data.role === 'admin') {
    requestSignInTicket(pin)
      .then(({ token, userId }) => { if (userId === data.id) storeSignInTicket(token, userId) })
      .catch(() => { /* the access page asks for the PIN if it is ever needed */ })
  }
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

// Name-based dashboard defaults (used before generic role fallback)
const NAME_DEFAULTS = {
  Bruce: ['production', 'executive', 'financial', 'coordinator', 'admin'],
  Danny: ['production', 'financial', 'coordinator'],
  Doron: ['financial'],
  Vuk: ['coordinator'],
  Nate: ['coordinator'],
}

// Get allowed dashboard keys for a specific user
export function getUserAllowedDashboards(user) {
  if (!user) return []

  const perms = getDashboardPermissions()

  // If permissions are configured for this user, use them
  if (perms && perms[user.id]) {
    return perms[user.id]
  }

  // Check name-based defaults (covers Doron → financial, etc.)
  const firstName = user.name?.split(' ')[0]
  if (firstName && NAME_DEFAULTS[firstName]) {
    return NAME_DEFAULTS[firstName]
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
