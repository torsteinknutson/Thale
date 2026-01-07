import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Logo } from '@fremtind/jokul/logo'
import HomePage from './pages/HomePage'
import TranscribePage from './pages/TranscribePage'
import RecordPage from './pages/RecordPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout" data-theme="light">
        {/* Header */}
        <header className="app-header">
          <div className="app-header__title">
            <Logo
              animated={false}
              isSymbol={true}
              title="Fremtind"
            />
            <h1 className="jkl-heading-2">THALE</h1>
          </div>
          <nav className="app-header__nav">
            <NavLink to="/" className="jkl-link">
              Hjem
            </NavLink>
            <NavLink to="/transcribe" className="jkl-link">
              Last opp
            </NavLink>
            <NavLink to="/record" className="jkl-link">
              Ta opp
            </NavLink>
          </nav>
        </header>

        {/* Main content */}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/transcribe" element={<TranscribePage />} />
            <Route path="/record" element={<RecordPage />} />
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
