// External backend API client for walden-backend.vercel.app
import { getActorTicket } from './auth'

const BACKEND_URL = 'https://walden-backend.vercel.app/api'

export async function fetchBackendAPI(path, params = {}) {
  const url = new URL(`${BACKEND_URL}/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Backend API error (${res.status})`)
  }
  return res.json()
}

// ⛔ From 2026-09-22 the back end refuses this list to anyone not signed in: it names each vendor's
// WSIB account number, certificate and Doron's decisions. The sign-in ticket travels in the
// x-walden-actor header; the back end answers the browser's permission check for that header.
export async function getVendorCompliance(days) {
  const url = new URL(`${BACKEND_URL}/vendor-compliance`)
  if (days != null) url.searchParams.set('days', days)
  const ticket = getActorTicket()
  // No ticket means this sign-in went the old direct way (the back end could not be reached), and
  // signing in again the same way would not help - so say what is actually wrong, not "sign in".
  if (!ticket) {
    throw new Error('This sign-in could not reach the Walden back end, and the vendor list needs it. Sign out, check the connection, and sign in again.')
  }
  const res = await fetch(url.toString(), { headers: { 'x-walden-actor': ticket } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Backend API error (${res.status})`)
  }
  return res.json()
}

export async function postVendorOverride(body) {
  const res = await fetch(`${BACKEND_URL}/wsib-override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Backend API error (${res.status})`)
  }
  return res.json()
}
