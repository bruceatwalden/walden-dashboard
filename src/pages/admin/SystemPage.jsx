export default function SystemPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-2.55a1.5 1.5 0 01-.19-2.59l9.36-5.97a1.5 1.5 0 012.14.63l2.48 7.12a1.5 1.5 0 01-1.04 1.95l-5.55 1.5a1.5 1.5 0 01-1.1-.09zM11.42 15.17L7.5 21M11.42 15.17L15.5 21" />
      </svg>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">System Health</h2>
      <p className="text-sm text-gray-500">Coming soon. Monitor API usage, storage, and system status.</p>
    </div>
  )
}
