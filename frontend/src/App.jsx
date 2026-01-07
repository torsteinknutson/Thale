import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Logo as JokulLogo } from '@fremtind/jokul/logo'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <BrowserRouter>
      <div className="app-layout" data-theme={theme}>
        <header className="app-header">
          <div className="header-left">
            <JokulLogo className="app-logo" />
          </div>
          <div className="header-center">
            <h1 className="app-title">Thale</h1>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Bytt tema"
              title={theme === 'light' ? 'Click for dark mode' : 'Click for light mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
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
