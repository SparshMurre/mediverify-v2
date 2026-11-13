import { useState } from 'react'
import { MapPin, Navigation, ExternalLink, Search, BadgeCheck, Phone, Clock } from 'lucide-react'

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function Nearby() {
  const [places, setPlaces] = useState([])
  const [cityQuery, setCityQuery] = useState('')
  const [janOnly, setJanOnly] = useState(false)
  const [status, setStatus] = useState('Use GPS or enter your locality to find nearby medical stores & Jan Aushadhi Kendras.')
  const [loading, setLoading] = useState(false)

  async function fetchPharmacies(latitude, longitude, label = 'your location') {
    setLoading(true)
    setStatus(`Searching medical stores within 5 km of ${label}...`)
    try {
      const query = `[out:json][timeout:15];(node["amenity"="pharmacy"](around:5000,${latitude},${longitude});way["amenity"="pharmacy"](around:5000,${latitude},${longitude});node["shop"="chemist"](around:5000,${latitude},${longitude}););out center 40;`
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query })
      const data = await res.json()

      const results = (data.elements || [])
        .map((el) => {
          const lat = el.lat || el.center?.lat
          const lon = el.lon || el.center?.lon
          const name = el.tags?.name || 'Medical Store / Chemist'
          const isJanAushadhi = /jan\s*aushadhi|pmbjp|bppi/i.test(`${name} ${el.tags?.operator || ''} ${el.tags?.brand || ''}`)
          return {
            id: el.id,
            name,
            isJanAushadhi,
            address: el.tags?.['addr:full'] || [el.tags?.['addr:street'], el.tags?.['addr:suburb'], el.tags?.['addr:city']].filter(Boolean).join(', ') || 'OpenStreetMap Verified Pharmacy',
            phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
            hours: el.tags?.opening_hours || '',
            lat,
            lon,
            distance: lat && lon ? getDistanceKm(latitude, longitude, lat, lon) : 999
          }
        })
        .sort((a, b) => Number(b.isJanAushadhi) - Number(a.isJanAushadhi) || a.distance - b.distance)

      setPlaces(results)
      setStatus(results.length ? `Found ${results.length} medical stores near ${label}.` : `No mapped pharmacies within 5 km of ${label}.`)
    } catch {
      setStatus('OpenStreetMap server is busy. Try again in a few seconds.')
    }
    setLoading(false)
  }
  function findByGPS() {
    if (!navigator.geolocation) return setStatus('Geolocation not supported.')
    setLoading(true)
    setStatus('Acquiring GPS coordinates...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => fetchPharmacies(coords.latitude, coords.longitude, 'your GPS location'),
      () => { setStatus('GPS unavailable. Enter your area/city below instead.'); setLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function findByCity(e) {
    e.preventDefault()
    if (!cityQuery.trim()) return
    setLoading(true)
    setStatus(`Locating "${cityQuery.trim()}"...`)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cityQuery.trim() + ', India')}`)
      const geo = await res.json()
      if (!geo.length) { setStatus(`Could not find "${cityQuery}". Try adding city name.`); setLoading(false); return }
      await fetchPharmacies(parseFloat(geo[0].lat), parseFloat(geo[0].lon), geo[0].display_name.split(',')[0])
    } catch { setStatus('Location lookup failed.'); setLoading(false) }
  }

  const visiblePlaces = janOnly ? places.filter((p) => p.isJanAushadhi) : places

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Nearby Medical Stores & Jan Aushadhi</h1>
            <p className="text-xs text-slate-500 mt-1">{status}</p>
          </div>
          <button onClick={findByGPS} disabled={loading} className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center gap-2 shrink-0">
            <Navigation className="w-4 h-4" />
            {loading ? 'Searching...' : 'Use My GPS'}
          </button>
        </div>

        <form onSubmit={findByCity} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input type="text" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="Or enter area / city (e.g. Sitabuldi Nagpur, Jagatpura Jaipur)..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800">Search Area</button>
        </form>

        {places.length > 0 && (
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input type="checkbox" checked={janOnly} onChange={(e) => setJanOnly(e.target.checked)} className="rounded accent-teal-600" />
            Show PMBJP Jan Aushadhi Kendras only ({places.filter((p) => p.isJanAushadhi).length} found)
          </label>
        )}
      </div>

      <div className="space-y-3">
        {visiblePlaces.map((p) => (
          <div key={p.id} className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-3 ${p.isJanAushadhi ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${p.isJanAushadhi ? 'text-emerald-600' : 'text-teal-600'}`} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-sm text-slate-900">{p.name}</h2>
                  {p.isJanAushadhi && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Jan Aushadhi Kendra
                    </span>
                  )}
                  {p.distance < 999 && (
                    <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      {p.distance < 1 ? `${Math.round(p.distance * 1000)} m` : `${p.distance.toFixed(1)} km`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{p.address}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">
                  {p.hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {p.hours}</span>}
                  {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-teal-700 font-medium"><Phone className="w-3 h-3" /> {p.phone}</a>}
                </div>
              </div>
            </div>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800 hover:bg-teal-100 flex items-center gap-1 shrink-0">
              Directions <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
