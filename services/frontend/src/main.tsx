import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import MapDashboard from './pages/MapDashboard'
import AdminReview from './pages/AdminReview'
import ReportDetail from './pages/ReportDetail'
import AlertSettings from './pages/AlertSettings'
import Login from './pages/Login'
import 'leaflet/dist/leaflet.css'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MapDashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><AdminReview /></ProtectedRoute>} />
            <Route path="/alerts" element={<AlertSettings />} />
            <Route path="/reports/:id" element={<ReportDetail />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
