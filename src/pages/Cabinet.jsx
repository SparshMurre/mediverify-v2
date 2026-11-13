import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, AlertTriangle, HeartPulse } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Cabinet({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadCabinet() {
    if (!user) return setLoading(false)
    const { data } = await supabase
      .from('cabinet')
      .select('*, medicines(*, salts(*))')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { loadCabinet() }, [user])

  async function removeItem(id) {
    await supabase.from('cabinet').delete().eq('id', id)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3">
        <HeartPulse className="w-8 h-8 text-teal-600 mx-auto" />
        <h1 className="font-bold text-lg text-slate-900">Personal Medicine Cabinet</h1>
        <p className="text-xs text-slate-500">Sign in to save medicines and check for duplicate active salts.</p>
        <Link to="/login" className="inline-block px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold">
          Sign In
        </Link>
      </div>
    )
  }

  // Detect duplicate active ingredients (salts) across saved medicines
  const saltCounts = {}
  items.forEach((i) => {
    const sName = i.medicines?.salts?.salt_name
    if (sName) saltCounts[sName] = (saltCounts[sName] || 0) + 1
  })
  const duplicateSalts = Object.keys(saltCounts).filter((s) => saltCounts[s] > 1)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">My Medicine Cabinet</h1>

      {duplicateSalts.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Duplicate Active Salt Alert!</p>
            <p className="mt-0.5">
              You have multiple medicines containing <strong>{duplicateSalts.join(', ')}</strong>. Avoid taking them together unless explicitly instructed by your doctor to prevent accidental overdose.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading cabinet...</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Your cabinet is empty. Search for any medicine and click <strong>Save to Cabinet</strong>.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <Link to={`/medicine/${item.medicine_id}`} className="font-bold text-slate-900 hover:text-teal-700">
                  {item.medicines?.brand_name}
                </Link>
                <p className="text-xs text-teal-700">{item.medicines?.salts?.salt_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">MRP: ₹{item.medicines?.official_mrp}</p>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
