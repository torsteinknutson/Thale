import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Logo as JokulLogo } from '@fremtind/jokul/logo'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <header className="app-header">
          <div className="header-left">
            <JokulLogo className="app-logo" />
          </div>
          <div className="header-center">
            <h1 className="app-title">Thale</h1>
          </div>
          <div className="header-right"></div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="app-footer">
          {/* Content removed as requested */}
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
