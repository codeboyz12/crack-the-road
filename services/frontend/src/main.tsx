import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapDashboard from './pages/MapDashboard'
import AdminReview from './pages/AdminReview'
import ReportDetail from './pages/ReportDetail'
import AlertSettings from './pages/AlertSettings'
import 'leaflet/dist/leaflet.css'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MapDashboard />} />
          <Route path="/admin" element={<AdminReview />} />
          <Route path="/alerts" element={<AlertSettings />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
