import { useState, useEffect } from 'react'
import Sidebar from './components/layout/Sidebar.jsx'
import FilterBar from './components/layout/FilterBar.jsx'
import DashboardPage from './components/dashboard/DashboardPage.jsx'
import IncidentsPage from './components/incidents/IncidentsPage.jsx'
import IRPage from './components/ir/IRPage.jsx'
import MonitoringPage from './components/monitoring/MonitoringPage.jsx'
import DiagnosticPage from './components/diagnostic/DiagnosticPage.jsx'
import LoginPage from './components/LoginPage.jsx'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('access_token'))
  const [activePage, setActivePage] = useState('dashboard')

  // Écouter les changements d'auth (ex: expiration token)
  useEffect(() => {
    const handler = () => setIsAuthenticated(!!localStorage.getItem('access_token'))
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={setActivePage} onLogout={() => {
        localStorage.clear()
        setIsAuthenticated(false)
      }} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <FilterBar />
        <main className="flex-1 overflow-y-auto p-6 transition-all">
          {activePage === 'dashboard' && <DashboardPage />}
          {activePage === 'incidents' && <IncidentsPage />}
          {activePage === 'ir' && <IRPage />}
          {activePage === 'monitoring' && <MonitoringPage />}
          {activePage === 'diagnostic' && <DiagnosticPage />}
        </main>
      </div>
    </div>
  )
}

