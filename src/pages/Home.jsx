import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BadgeCheck, ScanLine, ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [query, setQuery] = useState('')
  const [janOnly, setJanOnly] = useState(false)
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiAdvice, setAiAdvice] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      setAiAdvice(null)
      const q = query.trim()

      const { data, error } = await supabase.rpc('search_medicines', {
        search_term: q,
        only_jan: janOnly
      })

      if (!error && data) {
        setMedicines(data)
      } else {
        let req = supabase
          .from('medicines')
          .select('*, salts(salt_name, category)')
          .order('official_mrp', { ascending: true })
          .limit(40)
        if (janOnly) req = req.eq('is_jan_aushadhi', true)
        if (q) req = req.ilike('brand_name', `%${q}%`)
        const { data: fallback } = await req
        setMedicines(
          (fallback || []).map((m) => ({
            ...m,
            salt_name: m.salts?.salt_name,
            category: m.salts?.category
          }))
        )
      }
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query, janOnly])

  async function askAiRecommendation() {
    if (!query.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'recommend',
          query: query.trim(),
          matchedMedicines: medicines.slice(0, 6)
        })
      })
      const json = await res.json()
      setAiAdvice(json.error ? { error: json.error } : json)
    } catch {
      setAiAdvice({ error: 'Unable to reach AI advisor right now.' })
    }
    setAiLoading(false)
  }

  return (
    <div className="space-y-6">
      <section className="bg-gradient-to-br from-teal-700 to-emerald-800 text-white rounded-2xl p-5 sm:p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold">Verified Medicine & Generic Finder</h1>
        <p className="text-teal-100 text-sm sm:text-base mt-1.5 max-w-2xl">
          Search across 248,000+ Indian branded medicines & official PMBJP Jan Aushadhi generics by brand or active salt.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand (Augmentin 625, Dolo 650) or salt (Paracetamol)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <Link
            to="/verify"
            className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-amber-300"
          >
            <ScanLine className="w-4 h-4" />
            AI Strip Scan
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-teal-100 cursor-pointer">
            <input
              type="checkbox"
              checked={janOnly}
              onChange={(e) => setJanOnly(e.target.checked)}
              className="rounded accent-amber-400"
            />
            Show PMBJP Jan Aushadhi generics only
          </label>

          {query.trim().length >= 3 && (
            <button
              onClick={askAiRecommendation}
              disabled={aiLoading}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {aiLoading ? 'Analyzing with Gemini AI...' : `Ask AI Advisor about "${query.trim()}"`}
            </button>
          )}
        </div>
      </section>

      {aiAdvice && (
        <div className="bg-white border-2 border-teal-200 rounded-2xl p-5 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>MediVerify AI Clinical & Generic Advisor</span>
          </div>
          {aiAdvice.error ? (
            <p className="text-xs text-red-600">{aiAdvice.error}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-700 pt-1">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="font-bold text-slate-900 block">Active Salt & Clinical Use</span>
                <p className="mt-1 text-teal-700 font-semibold">{aiAdvice.identified_salt}</p>
                <p className="mt-1">{aiAdvice.clinical_use}</p>
              </div>
              <div className="bg-emerald-50/70 p-3 rounded-xl">
                <span className="font-bold text-emerald-950 block">Generic Bioequivalence & Savings</span>
                <p className="mt-1">{aiAdvice.bioequivalence_note}</p>
                <p className="mt-1 font-medium text-emerald-800">{aiAdvice.recommended_action}</p>
              </div>
              <div className="sm:col-span-2 bg-amber-50 p-3 rounded-xl text-amber-950">
                <strong>Safety & Prescription Warning:</strong> {aiAdvice.safety_warnings}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-36 rounded-xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
      ) : medicines.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-slate-500 text-sm">No exact database match for "{query}".</p>
          <button
            onClick={askAiRecommendation}
            disabled={aiLoading}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? 'Asking Gemini AI...' : 'Identify & Recommend Generic via Gemini AI'}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((med) => (
            <Link
              key={med.id}
              to={`/medicine/${med.id}`}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-500 hover:shadow-sm transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {med.category || 'Allopathy'}
                  </span>
                  {med.is_jan_aushadhi && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Jan Aushadhi
                    </span>
                  )}
                </div>

                <h2 className="font-bold text-slate-900 mt-2">{med.brand_name}</h2>
                <p className="text-xs text-teal-700 font-medium mt-0.5">{med.salt_name}</p>
                <p className="text-xs text-slate-500 mt-1">{med.manufacturer} • {med.pack_size}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-slate-900">₹{Number(med.official_mrp).toFixed(2)}</span>
                  <span className="block text-[10px] text-slate-400">{med.price_source}</span>
                </div>
                <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                  Compare <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
