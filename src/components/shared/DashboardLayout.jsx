import { useAuth } from '../../hooks/useAuth'
import { useAutoCategorizer } from '../../hooks/useAutoCategorizer'
import { useNavigate, useLocation, Link } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/danny', label: 'Production' },
  { path: '/bruce', label: 'Executive' },
  { path: '/doron', label: 'Financial' },
  { path: '/coordinator', label: 'Coordinator' },
]

export default function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth()
  const autoCat = useAutoCategorizer()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Walden Dashboard</h1>
            <div className="flex items-center gap-4">
              {autoCat && (autoCat.status === 'processing' || autoCat.pending > 0 || autoCat.status === 'error') && (
                <div className="flex items-center gap-1.5 text-xs">
                  {autoCat.status === 'processing' ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-gray-400">
                        Tagging {autoCat.pending} photo{autoCat.pending !== 1 ? 's' : ''}
                      </span>
                    </>
                  ) : autoCat.status === 'error' ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="text-gray-400">Auto-tag paused</span>
                    </>
                  ) : (
                    <span className="text-gray-400">
                      {autoCat.pending} untagged
                    </span>
                  )}
                </div>
              )}
              <span className="text-sm text-gray-600">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
          <nav className="flex gap-1 -mb-px">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
