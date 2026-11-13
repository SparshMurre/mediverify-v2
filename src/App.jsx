import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import MedicineDetail from './pages/MedicineDetail'
import Login from './pages/Login'

// Lazy-load heavy scanner and map routes so mobile initial load stays tiny
const Verify = lazy(() => import('./pages/Verify'))
const Cabinet = lazy(() => import('./pages/Cabinet'))
const Nearby = lazy(() => import('./pages/Nearby'))

export default function App() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
        <Navbar user={user} />
        <main className="max-w-5xl mx-auto px-4 pt-6">
          <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading module...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/medicine/:id" element={<MedicineDetail user={user} />} />
              <Route path="/verify" element={<Verify user={user} />} />
              <Route path="/cabinet" element={<Cabinet user={user} />} />
              <Route path="/nearby" element={<Nearby />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  )
}
