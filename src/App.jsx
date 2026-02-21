import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { AutoCategorizerProvider } from './hooks/useAutoCategorizer'
import { getDefaultPath, canAccessPath } from './lib/auth'
import Login from './pages/Login'
import DannyDashboard from './pages/DannyDashboard'
import BruceDashboard from './pages/BruceDashboard'
import DoronDashboard from './pages/DoronDashboard'
import CoordinatorDashboard from './pages/CoordinatorDashboard'
import PhotoGallery from './pages/PhotoGallery'
import AdminRoutes from './pages/admin/AdminRoutes'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace />
  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={getDefaultPath(user)} replace />
  }
  return children
}

function LoginRoute() {
  const { user } = useAuth()
  if (user) return <Navigate to={getDefaultPath(user)} replace />
  return <Login />
}

function RootRedirect() {
  const { user } = useAuth()
  if (user) return <Navigate to={getDefaultPath(user)} replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <AutoCategorizerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/photos" element={<PhotoGallery />} />
            <Route path="/gallery" element={<PhotoGallery />} />
            <Route path="/admin/*" element={<ProtectedRoute><AdminRoutes /></ProtectedRoute>} />
            <Route path="/danny" element={<ProtectedRoute><DannyDashboard /></ProtectedRoute>} />
            <Route path="/bruce" element={<ProtectedRoute><BruceDashboard /></ProtectedRoute>} />
            <Route path="/doron" element={<ProtectedRoute><DoronDashboard /></ProtectedRoute>} />
            <Route path="/coordinator" element={<ProtectedRoute><CoordinatorDashboard /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AutoCategorizerProvider>
    </AuthProvider>
  )
}
