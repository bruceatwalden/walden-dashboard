import { useState } from 'react'
import { submitWorkInboxReport } from '../../lib/api'

// In-app "Report a problem / Ask a question" for the WSIB vendor-compliance panel.
// Mirrors site-log's ReportProblem (bug/idea toggle → work_inbox) but trimmed for
// the dashboard: no voice/photo deps, files through the backend endpoint. The report
// lands on Bruce's Session Board automatically.
export default function ReportProblemModal({ initialType = 'bug', onClose }) {
  const [type, setType] = useState(initialType) // 'bug' | 'idea'
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const isBug = type === 'bug'
  const canSubmit = description.trim() && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setError('')
    setSubmitting(true)
    try {
      await submitWorkInboxReport({
        type,
        description,
        source: 'wsib-dashboard',
        app: 'dashboard',
        screen: 'vendor-compliance',
      })
      setDone(true)
    } catch (err) {
      setError(err.message || 'Something went wrong sending your report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {done ? 'Sent' : 'Report a problem or ask a question'}
          </h2>
          <button onClick={onClose} className="p-1 -mr-1 text-gray-400 hover:text-gray-700" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Thanks — Bruce will see this.</h3>
            <p className="text-sm text-gray-500 mb-6">
              Your {isBug ? 'report' : 'question'} has been sent.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Bug / Question toggle */}
            <div className="bg-gray-50 rounded-xl p-1.5 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setType('bug')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isBug ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                🐞 Something's wrong
              </button>
              <button
                onClick={() => setType('idea')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  !isBug ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                💡 Question or idea
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {isBug
                  ? 'What looks wrong? (which vendor, what you expected)'
                  : 'What would you like to know?'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={
                  isBug
                    ? "e.g. ABC Carpentry shows Not Cleared but I have their current certificate"
                    : 'e.g. why is ABC Carpentry in the needs-a-look list?'
                }
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                canSubmit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {submitting ? 'Sending…' : 'Send to Bruce'}
            </button>
            <p className="text-center text-xs text-gray-400">Goes straight to Bruce — no one else sees it.</p>
          </div>
        )}
      </div>
    </div>
  )
}
