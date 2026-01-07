import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Logo as JokulLogo } from '@fremtind/jokul/logo'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <JokulLogo className="app-logo" />
            <h1 className="jkl-heading-2" style={{ marginLeft: '1rem', color: 'var(--jkl-color-text-default)' }}>
              Thale
            </h1>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <p>THALE - Speech-to-Text for Fremtind Forsikring</p>
          <p>Intern bruk</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
