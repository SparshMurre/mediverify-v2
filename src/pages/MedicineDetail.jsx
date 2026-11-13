import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Share2, PlusCircle, AlertTriangle, BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function MedicineDetail({ user }) {
  const { id } = useParams()
  const [med, setMed] = useState(null)
  const [alternatives, setAlternatives] = useState([])
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('medicines')
        .select('*, salts(*)')
        .eq('id', id)
        .single()
      if (!data) return
      setMed(data)

      const { data: alts } = await supabase
        .from('medicines')
        .select('*')
        .eq('salt_id', data.salt_id)
        .order('official_mrp', { ascending: true })
      setAlternatives(alts || [])
    }
    load()
  }, [id])

  async function addToCabinet() {
    if (!user) return setSavedMsg('Please sign in first to save medicines to your cabinet.')
    const { error } = await supabase.from('cabinet').insert({
      user_id: user.id,
      medicine_id: med.id
    })
    setSavedMsg(error ? error.message : 'Saved to My Cabinet!')
  }

  function shareWhatsApp() {
    const cheapest = alternatives[0]
    const text = `MediVerify Info:\nMedicine: ${med.brand_name} (${med.salts?.salt_name})\nMRP: ₹${med.official_mrp}\nCheapest Same-Salt Option: ${cheapest?.brand_name} at ₹${cheapest?.official_mrp}`
    if (navigator.share) {
      navigator.share({ title: med.brand_name, text })
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  if (!med) return <div className="p-8 text-center text-slate-500 text-sm">Loading medicine details...</div>

  const cheapest = alternatives[0]
  const savings = cheapest && med.official_mrp > cheapest.official_mrp
    ? Math.round(((med.official_mrp - cheapest.official_mrp) / med.official_mrp) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-teal-700">
        <ArrowLeft className="w-4 h-4" /> Back to search
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
              {med.salts?.category}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">{med.brand_name}</h1>
            <p className="text-sm font-medium text-teal-700">{med.salts?.salt_name}</p>
            <p className="text-xs text-slate-500 mt-1">{med.manufacturer} • {med.pack_size}</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-slate-900">₹{Number(med.official_mrp).toFixed(2)}</span>
            <span className="block text-[11px] text-slate-500">{med.price_source}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            onClick={addToCabinet}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Save to Cabinet
          </button>
          <button
            onClick={shareWhatsApp}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" /> Share Info
          </button>
        </div>
        {savedMsg && <p className="mt-2.5 text-xs font-medium text-teal-700">{savedMsg}</p>}
      </div>

      {/* Same-Salt Generic Comparison */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Same-Salt Alternatives ({alternatives.length})</h2>
          {savings > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              Save up to {savings}%
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {alternatives.map((alt) => (
            <Link
              key={alt.id}
              to={`/medicine/${alt.id}`}
              className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{alt.brand_name}</span>
                  {alt.is_jan_aushadhi && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Jan Aushadhi
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">{alt.manufacturer} • {alt.pack_size}</span>
              </div>
              <span className="font-bold text-slate-900">₹{Number(alt.official_mrp).toFixed(2)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Clinical Information */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 text-sm">
        <div>
          <h3 className="font-bold text-slate-900">Indications & Uses</h3>
          <p className="text-slate-600 mt-1">{med.salts?.indications}</p>
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Common Side Effects</h3>
          <p className="text-slate-600 mt-1">{med.salts?.side_effects}</p>
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Warnings & Precautions</h3>
          <p className="text-slate-600 mt-1">{med.salts?.warnings}</p>
        </div>
        <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
          Clinical Source: {med.salts?.clinical_source}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Educational reference only. Always consult a registered doctor or pharmacist before substituting or changing any prescribed medicine.</p>
      </div>
    </div>
  )
}
