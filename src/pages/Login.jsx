import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { login, getDefaultPath } from '../lib/auth'

export default function Login() {
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef([])
  const navigate = useNavigate()
  const { loginUser } = useAuth()

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  function handleChange(index, value) {
    if (!/^\d?$/.test(value)) return

    const next = [...pin]
    next[index] = value
    setPin(next)
    setError('')

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (value && index === 3) {
      const fullPin = next.join('')
      if (fullPin.length === 4) {
        handleLogin(fullPin)
      }
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!pasted) return

    const next = [...pin]
    for (let i = 0; i < 4; i++) {
      next[i] = pasted[i] || ''
    }
    setPin(next)

    if (pasted.length === 4) {
      handleLogin(pasted)
    } else {
      inputRefs.current[Math.min(pasted.length, 3)]?.focus()
    }
  }

  async function handleLogin(fullPin) {
    setLoading(true)
    setError('')

    try {
      const result = await login(fullPin)
      if (!result) {
        setError('Invalid PIN')
        setPin(['', '', '', ''])
        inputRefs.current[0]?.focus()
        return
      }
      if (result.access_denied) {
        setError('Dashboard access not enabled for this account')
        setPin(['', '', '', ''])
        inputRefs.current[0]?.focus()
        return
      }
      loginUser(result)
      navigate(getDefaultPath(result), { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
      setPin(['', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
          Walden Dashboard
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Enter your PIN
        </p>

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className="w-11 h-14 text-center text-2xl font-mono border-2 border-gray-300 rounded-lg
                         focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                         disabled:bg-gray-100 disabled:text-gray-400"
            />
          ))}
        </div>

        {error && (
          <p className="text-red-600 text-sm text-center mb-4">{error}</p>
        )}

        {loading && (
          <p className="text-gray-500 text-sm text-center">Signing in...</p>
        )}
      </div>
    </div>
  )
}
