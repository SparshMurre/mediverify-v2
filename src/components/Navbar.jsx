import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, ScanLine, HeartPulse, MapPin, LogIn, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Navbar({ user }) {
  const { pathname } = useLocation()
  const navItems = [
    { to: '/', label: 'Search', icon: ShieldCheck },
    { to: '/verify', label: 'Scan & Verify', icon: ScanLine },
    { to: '/cabinet', label: 'Cabinet', icon: HeartPulse },
    { to: '/nearby', label: 'Pharmacies', icon: MapPin },
  ]

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-teal-700 text-lg">
          <ShieldCheck className="w-6 h-6" />
          <span>MediVerify</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
                pathname === to ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div>
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>

      {/* Bottom Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-4 py-1.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
              pathname === to ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  )
}
