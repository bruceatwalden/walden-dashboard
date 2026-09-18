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

// Where the PIN is checked — the shared back end, the same door every Walden sign-in screen uses.
const BACKEND = 'https://walden-backend.vercel.app'

/**
 * Sign in with a PIN. Returns the user object, { access_denied: true } for a right PIN whose account
 * is not an admin or coordinator, or null for a PIN that is not recognised. Throws an Error with a
 * message to show when sign-in is paused for too many wrong PINs.
 *
 * ⭐ THE PIN IS CHECKED BY THE SHARED BACK END, behind its limit on wrong PINs (2026-09-18). It used
 * to be checked straight against the database with the key published in this page, with no limit
 * at all. The back end checks the PIN and the admin/coordinator rule in one step.
 *
 * ⛔ THE DASHBOARD'S OWN WEB ADDRESS MUST BE ON THE BACK END'S LIST (walden-backend
 * api/_lib/staff-cors.js) or the browser refuses the answer. On 2026-09-18 the Dashboard was not
 * published and its address was unknown; add it when it is revived, BEFORE migration 256.
 *
 * ⛔ The old way is kept ONLY for when the back end cannot be reached at all. It stops working the
 * day the database stops answering the published key (migration 256). A refusal never falls back.
 */
export async function login(pin) {
  let res = null
  try {
    res = await fetch(`${BACKEND}/api/staff-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign-in', pin, app_id: 'dashboard' }),
    })
  } catch {
    res = null
  }
  if (res && res.status === 401) return null
  if (res && res.status === 403) return { access_denied: true }
  if (res && res.status === 429) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || 'Too many wrong PINs have been tried. Try again later.')
  }
  if (res && res.ok) {
    const json = await res.json().catch(() => ({}))
    if (json.user?.id && json.token) {
      saveSession(json.user)
      return json.user
    }
  }
  return loginDirect(pin)
}

// The old way, for when the back end could not be reached. See login().
async function loginDirect(pin) {
  const { data, error } = await supabase.rpc('authenticate_cm', {
    pin_input: pin,
  })

  // Not "wrong PIN": the PIN was never checked. Once the database stops answering this page's key,
  // this is what a back-end outage looks like here.
  if (error) throw new Error('The PIN could not be checked just now. Try again.')
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
