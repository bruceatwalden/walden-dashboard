import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getDefaultPath, canAccessPath } from '../../lib/auth'
import AdminLayout from '../../components/admin/AdminLayout'
import DashboardAccessPage from './DashboardAccessPage'
import PhotoTaggingPage from './PhotoTaggingPage'
import GallerySettingsPage from './GallerySettingsPage'
import CategoriesPage from './CategoriesPage'
import NotificationsPage from './NotificationsPage'
import SystemPage from './SystemPage'

function AdminGuard({ children }) {
  const { user } = useAuth()
  if (!canAccessPath(user, '/admin')) {
    return <Navigate to={getDefaultPath(user)} replace />
  }
  return children
}

export default function AdminRoutes() {
  return (
    <AdminGuard>
      <AdminLayout>
        <Routes>
          <Route index element={<Navigate to="/admin/dashboard-access" replace />} />
          <Route path="dashboard-access" element={<DashboardAccessPage />} />
          <Route path="photo-tagging" element={<PhotoTaggingPage />} />
          <Route path="gallery-settings" element={<GallerySettingsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="system" element={<SystemPage />} />
        </Routes>
      </AdminLayout>
    </AdminGuard>
  )
}
