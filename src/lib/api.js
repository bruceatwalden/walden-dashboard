// External backend API client for walden-backend.vercel.app

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

export function getVendorCompliance(days) {
  return fetchBackendAPI('vendor-compliance', { days })
}
