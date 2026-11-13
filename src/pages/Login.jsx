import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg({ type: '', text: '' })
    setLoading(true)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) return setMsg({ type: 'error', text: error.message })
      if (data.session) return navigate('/')
      setMsg({ type: 'ok', text: 'Account created! You can now sign in.' })
      setIsSignUp(false)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) return setMsg({ type: 'error', text: error.message })
      navigate('/')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 mt-6 shadow-xs">
      <div className="flex items-center gap-2 text-teal-700 font-bold text-lg">
        <ShieldCheck className="w-6 h-6" />
        <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Access your personal medicine cabinet, duplicate-salt alerts, and batch reporting.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
        <div>
          <label className="text-xs font-semibold text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {msg.text && (
          <p className={`text-xs font-medium ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {msg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 disabled:opacity-60"
        >
          {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => { setIsSignUp(!isSignUp); setMsg({ type: '', text: '' }) }}
        className="mt-4 text-xs text-teal-700 font-medium hover:underline block mx-auto"
      >
        {isSignUp ? 'Already have an account? Sign In' : 'New here? Create an account'}
      </button>
    </div>
  )
}
