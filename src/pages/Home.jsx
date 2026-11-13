import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BadgeCheck, ScanLine, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [query, setQuery] = useState('')
  const [janOnly, setJanOnly] = useState(false)
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      const q = query.trim()

      let matchingSaltIds = []
      if (q) {
        const { data: saltHits } = await supabase
          .from('salts')
          .select('id')
          .ilike('salt_name', `%${q}%`)
        matchingSaltIds = (saltHits || []).map((s) => s.id)
      }

      let req = supabase
        .from('medicines')
        .select('*, salts(*)')
        .order('official_mrp', { ascending: true })
        .limit(40)

      if (janOnly) req = req.eq('is_jan_aushadhi', true)

      if (q) {
        const filters = [`brand_name.ilike.%${q}%`, `manufacturer.ilike.%${q}%`]
        if (matchingSaltIds.length > 0) {
          filters.push(`salt_id.in.(${matchingSaltIds.join(',')})`)
        }
        req = req.or(filters.join(','))
      }

      const { data } = await req
      setMedicines(data || [])
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query, janOnly])

  return (
    <div className="space-y-6">
      <section className="bg-gradient-to-br from-teal-700 to-emerald-800 text-white rounded-2xl p-5 sm:p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold">Verified Medicine & Generic Finder</h1>
        <p className="text-teal-100 text-sm sm:text-base mt-1.5 max-w-2xl">
          Search by brand or active salt to compare official PMBJP Jan Aushadhi generic tariffs against retail brands.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand (Dolo 650) or salt (Paracetamol, Atorvastatin)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <Link
            to="/verify"
            className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-amber-300"
          >
            <ScanLine className="w-4 h-4" />
            Scan Strip / QR
          </Link>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-xs sm:text-sm text-teal-100 cursor-pointer">
          <input
            type="checkbox"
            checked={janOnly}
            onChange={(e) => setJanOnly(e.target.checked)}
            className="rounded accent-amber-400"
          />
          Show PMBJP Jan Aushadhi generics only
        </label>
      </section>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-36 rounded-xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
      ) : medicines.length === 0 ? (
        <p className="text-center text-slate-500 py-10 text-sm">No medicines matched "{query}".</p>
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
                    {med.salts?.category}
                  </span>
                  {med.is_jan_aushadhi && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Jan Aushadhi
                    </span>
                  )}
                </div>

                <h2 className="font-bold text-slate-900 mt-2">{med.brand_name}</h2>
                <p className="text-xs text-teal-700 font-medium mt-0.5">{med.salts?.salt_name}</p>
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
