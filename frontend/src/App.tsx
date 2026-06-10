import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme } from 'antd'
import koKR from 'antd/locale/ko_KR'
import AppShell from './components/layout/AppShell'
import VehiclesPage from './pages/VehiclesPage'
import FormationsPage from './pages/FormationsPage'
import CompatibilityPage from './pages/CompatibilityPage'
import DiagramPage from './pages/DiagramPage'
import SearchPage from './pages/SearchPage'
import RequestsPage from './pages/RequestsPage'
import LoginLogsPage from './pages/LoginLogsPage'
import LoginPage from './pages/LoginPage'
import BomPage from './pages/BomPage'
import CatalogPage from './pages/CatalogPage'
import HomePage from './pages/HomePage'
import MaintenancePage from './pages/MaintenancePage'
import MaterialMasterPage from './pages/MaterialMasterPage'
import OfflineDownloadPage from './pages/OfflineDownloadPage'
import HelpPage from './pages/HelpPage'
import MaterialActivityPage from './pages/MaterialActivityPage'
import InquiriesPage from './pages/InquiriesPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [role, setRole] = useState(() => localStorage.getItem('role') ?? '')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')

  const toggleDark = () => {
    setDarkMode(prev => {
      localStorage.setItem('darkMode', String(!prev))
      return !prev
    })
  }

  const handleLogin = (newToken: string, newRole: string, _userId: string) => {
    setToken(newToken)
    setRole(newRole)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('user_id')
    setToken(null)
    setRole('')
  }

  const themeConfig = {
    token: { colorPrimary: '#1F4E79' },
    algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  }

  if (!token) {
    return (
      <ConfigProvider locale={koKR} theme={themeConfig}>
        <LoginPage onLogin={handleLogin} />
      </ConfigProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={koKR} theme={themeConfig}>
        <BrowserRouter>
          <AppShell role={role} onLogout={handleLogout} darkMode={darkMode} onToggleDark={toggleDark}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/diagram" element={<DiagramPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/formations" element={<FormationsPage />} />
              <Route path="/compatibility" element={<CompatibilityPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/bom" element={<BomPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/material-master" element={<MaterialMasterPage />} />
              <Route path="/offline" element={<OfflineDownloadPage />} />
              <Route path="/help" element={<HelpPage role={role} />} />
              {role === 'admin' && <Route path="/requests" element={<RequestsPage />} />}
              {role === 'admin' && <Route path="/login-logs" element={<LoginLogsPage />} />}
              {role === 'admin' && <Route path="/material-activity" element={<MaterialActivityPage />} />}
              <Route path="/inquiries" element={<InquiriesPage role={role} />} />
              <Route path="*" element={<Navigate to="/diagram" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
