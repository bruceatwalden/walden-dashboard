// Plain-English "How this works" panel for the WSIB vendor-compliance dashboard.
// Static content (no AI) — answers the predictable questions so Doron can self-serve,
// with a footer button that routes anything else to Bruce via the report form.

const SECTIONS = [
  { dot: 'bg-red-500', label: 'Not Cleared', text: 'No current WSIB clearance on file (or it says No). These need attention.' },
  { dot: 'bg-amber-500', label: 'Expiring Soon', text: 'Cleared for the current period, but the next period is not confirmed yet.' },
  { dot: 'bg-green-500', label: 'Cleared', text: 'Current WSIB clearance is confirmed — you can open their official certificate from the row.' },
  { dot: 'bg-orange-500', label: 'COI Expired', text: 'Their Certificate of Insurance has passed its expiry date.' },
  { dot: 'bg-gray-400', label: 'Excluded', text: 'Marked as not needing WSIB clearance (e.g. a supplier only, or owner-direct).' },
  { dot: 'bg-blue-500', label: 'Untracked', text: 'They appear in invoices but were not found in the WSIB list — worth a look.' },
]

export default function VendorComplianceHelp({ onClose, onAskQuestion }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">How the WSIB dashboard works</h2>
          <button onClick={onClose} className="p-1 -mr-1 text-gray-400 hover:text-gray-700" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6 text-sm text-gray-700">
          {/* What it is */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5">What this shows</h3>
            <p>
              Each vendor's current WSIB clearance status, pulled straight from WSIB's own
              clearance website. When a vendor is cleared, their official WSIB certificate is
              saved here so you can open it from the row.
            </p>
          </section>

          {/* Auto-refresh */}
          <section className="bg-blue-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-1.5">It keeps itself up to date</h3>
            <p className="text-blue-900/90">
              The whole list refreshes automatically every few months — there is nothing for you
              to run or install. You just open this page whenever you need to check a vendor. If
              you ever want a fresh check sooner, ask Bruce and he can run one.
            </p>
          </section>

          {/* Colour legend */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">What the groups mean</h3>
            <ul className="space-y-2">
              {SECTIONS.map((s) => (
                <li key={s.label} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span>
                    <span className="font-semibold text-gray-900">{s.label}</span>
                    {' — '}
                    {s.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Needs a look */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5">The "needs a look" few</h3>
            <p>
              A handful of vendors can't be confirmed automatically — usually because the name is
              spelled differently on WSIB, or more than one company comes up with a similar name.
              The tool never guesses; it leaves these for a person to confirm. For those, look the
              vendor up on WSIB directly, then update their status here.
            </p>
          </section>

          {/* Ask */}
          <section className="border-t border-gray-100 pt-5">
            <p className="text-gray-600 mb-3">Still have a question, or something looks wrong?</p>
            <button
              onClick={onAskQuestion}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Ask a question / report a problem
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
