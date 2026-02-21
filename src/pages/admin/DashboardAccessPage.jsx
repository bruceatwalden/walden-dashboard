import { useState, useCallback, useEffect } from 'react'
import { getCMUsers } from '../../lib/queries'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { useAuth } from '../../hooks/useAuth'
import {
  ALL_DASHBOARDS,
  getDashboardPermissions,
  saveDashboardPermissions,
} from '../../lib/auth'

// Default permissions by user name (used when no localStorage config exists)
const DEFAULT_PERMISSIONS_BY_NAME = {
  Bruce: ['production', 'executive', 'financial', 'coordinator', 'admin'],
  Danny: ['production', 'financial', 'coordinator'],
  Doron: ['financial'],
  Vuk: ['coordinator'],
  Nate: ['coordinator'],
}

export default function DashboardAccessPage() {
  const { user } = useAuth()
  const fetchUsers = useCallback(() => getCMUsers(user.id), [user.id])
  const { data: users, loading } = useDashboardQuery(fetchUsers, 0)

  const [permissions, setPermissions] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  // Dashboard users = admin + coordinator roles only
  const dashboardUsers = (users || []).filter(
    (u) => u.role === 'admin' || u.role === 'coordinator'
  )

  // Initialize permissions from localStorage or defaults
  useEffect(() => {
    if (!dashboardUsers.length) return

    const stored = getDashboardPermissions()
    if (stored) {
      // Use stored, but fill in any users not yet configured
      const merged = { ...stored }
      for (const u of dashboardUsers) {
        if (!merged[u.id]) {
          // Check name-based defaults
          const firstName = u.name.split(' ')[0]
          merged[u.id] = DEFAULT_PERMISSIONS_BY_NAME[firstName] || fallbackForRole(u.role)
        }
      }
      setPermissions(merged)
    } else {
      // First time — build from name-based defaults
      const initial = {}
      for (const u of dashboardUsers) {
        const firstName = u.name.split(' ')[0]
        initial[u.id] = DEFAULT_PERMISSIONS_BY_NAME[firstName] || fallbackForRole(u.role)
      }
      setPermissions(initial)
      setDirty(true) // mark dirty so user saves the defaults
    }
  }, [users]) // eslint-disable-line react-hooks/exhaustive-deps

  function fallbackForRole(role) {
    if (role === 'admin') return ALL_DASHBOARDS.map((d) => d.key)
    if (role === 'coordinator') return ['coordinator']
    return []
  }

  function togglePermission(userId, dashboardKey) {
    setPermissions((prev) => {
      const current = prev[userId] || []
      const next = current.includes(dashboardKey)
        ? current.filter((k) => k !== dashboardKey)
        : [...current, dashboardKey]
      return { ...prev, [userId]: next }
    })
    setDirty(true)
    setSaved(false)
  }

  function handleSave() {
    saveDashboardPermissions(permissions)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Check if Doron exists
  const doronExists = (users || []).some(
    (u) => u.name.toLowerCase().startsWith('doron')
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Dashboard Access</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Control which dashboards each user can access. CMs (field workers) are excluded — they use SiteLog, not this dashboard.
        </p>
      </div>

      {!doronExists && users && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>Note:</strong> Doron does not exist in cm_users yet. Add him there first so he can log in.
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading users...</div>
        ) : !dashboardUsers.length ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No admin or coordinator users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  {ALL_DASHBOARDS.map((d) => (
                    <th
                      key={d.key}
                      className="px-4 py-3 font-medium text-gray-600 text-center w-24"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboardUsers.map((u) => {
                  const userPerms = permissions[u.id] || []
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {u.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-teal-100 text-teal-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      {ALL_DASHBOARDS.map((d) => (
                        <td key={d.key} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={userPerms.includes(d.key)}
                            onChange={() => togglePermission(u.id, d.key)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Save Changes
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
        {dirty && !saved && (
          <span className="text-xs text-amber-500">Unsaved changes</span>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Changes take effect on the user's next page load. The logged-in user's nav tabs and route access update automatically.
      </p>
    </div>
  )
}
