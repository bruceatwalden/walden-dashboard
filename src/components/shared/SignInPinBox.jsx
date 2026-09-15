import { useRef, useState } from 'react'
import { requestSignInTicket, storeSignInTicket, revokeSignInTicket } from '../../lib/auth'

// The PIN, asked for ONCE, when a page needs a sign-in ticket and this sign-in has none.
// ⛔ The ticket is kept only if the server says the PIN belongs to the person signed in here.
export default function SignInPinBox({ user, message, onConfirmed }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)
  const busy = useRef(false)

  async function confirm() {
    if (pin.length !== 4 || busy.current) return
    busy.current = true
    setChecking(true)
    setError(null)
    try {
      const { token, userId } = await requestSignInTicket(pin, user?.id)
      if (userId !== user?.id) {
        revokeSignInTicket(token) // a ticket that is not this person's must not be left behind
        setError('That PIN did not work. Enter your own PIN.')
        return
      }
      storeSignInTicket(token, userId)
      await onConfirmed?.(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setPin('')
      busy.current = false
      setChecking(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2 text-left">
      <p className="text-sm text-amber-800">{message || 'This needs your PIN, once.'}</p>
      <div className="flex gap-2">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirm() } }}
          placeholder="PIN"
          aria-label="Your PIN"
          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={confirm}
          disabled={checking || pin.length !== 4}
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {checking ? 'Checking…' : 'Confirm'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
