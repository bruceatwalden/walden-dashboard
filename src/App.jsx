import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { AutoCategorizerProvider } from './hooks/useAutoCategorizer'
import { getRolePath } from './lib/auth'
import Login from './pages/Login'
import DannyDashboard from './pages/DannyDashboard'
import BruceDashboard from './pages/BruceDashboard'
import DoronDashboard from './pages/DoronDashboard'
import CoordinatorDashboard from './pages/CoordinatorDashboard'
import PhotoGallery from './pages/PhotoGallery'
import CategorizePhotos from './pages/CategorizePhotos'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function LoginRoute() {
  const { user } = useAuth()
  if (user) return <Navigate to={getRolePath(user.role)} replace />
  return <Login />
}

function RootRedirect() {
  const { user } = useAuth()
  if (user) return <Navigate to={getRolePath(user.role)} replace />
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
            <Route path="/admin/categorize-photos" element={<ProtectedRoute><CategorizePhotos /></ProtectedRoute>} />
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
