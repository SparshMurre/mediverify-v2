import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ShieldAlert, CheckCircle2, Search, FileWarning, Sparkles, BadgeCheck } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'

function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 1024
        const scale = Math.min(1, maxW / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = ev.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Verify({ user }) {
  const [tab, setTab] = useState('ocr')
  const [batchInput, setBatchInput] = useState('')
  const [expiryInput, setExpiryInput] = useState('')
  const [batchResult, setBatchResult] = useState(null)

  const [qrResult, setQrResult] = useState('')
  const [scanningQr, setScanningQr] = useState(false)
  const qrScannerRef = useRef(null)

  const [scanStatus, setScanStatus] = useState('')
  const [aiScanData, setAiScanData] = useState(null)
  const [scanMatches, setScanMatches] = useState([])
  const [previewUrl, setPreviewUrl] = useState('')

  const [reportForm, setReportForm] = useState({ medicine_name: '', batch_no: '', pharmacy_name: '', description: '' })
  const [reportMsg, setReportMsg] = useState('')

  async function checkBatch(e) {
    if (e) e.preventDefault()
    if (!batchInput.trim()) return

    const { data } = await supabase
      .from('nsq_alerts')
      .select('*')
      .ilike('batch_no', `%${batchInput.trim()}%`)

    const isExpired = expiryInput ? new Date(expiryInput) < new Date() : false
    setBatchResult({
      alerts: data || [],
      isExpired,
      checkedBatch: batchInput.trim().toUpperCase()
    })
  }

  async function startQrScan() {
    setQrResult('')
    setScanningQr(true)
    try {
      const scanner = new Html5Qrcode('qr-reader')
      qrScannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          setQrResult(decodedText)
          stopQrScan()
        },
        () => {}
      )
    } catch {
      setQrResult('Camera permission denied or unavailable on this device.')
      setScanningQr(false)
    }
  }

  async function stopQrScan() {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop()
        qrScannerRef.current.clear()
      } catch {}
      qrScannerRef.current = null
    }
    setScanningQr(false)
  }

  useEffect(() => () => { stopQrScan() }, [])

  async function handleStripPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    setScanStatus('Analyzing medicine strip with Gemini Vision AI...')
    setAiScanData(null)
    setScanMatches([])

    try {
      const base64 = await compressImageToBase64(file)
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'scan',
          imageBase64: base64,
          mimeType: 'image/jpeg'
        })
      })

      const ai = await res.json()
      if (!res.ok || ai.error) {
        setScanStatus(ai.error || 'AI scan failed. Please check GEMINI_API_KEY in Vercel.')
        return
      }

      setAiScanData(ai)
      setScanStatus('Searching 248,000+ medicines & Jan Aushadhi generics for matching salt...')

      const saltKeyword = (ai.salt_composition || '').split(/[+(0-9]/)[0].trim()
      const brandKeyword = (ai.brand_name || '').split(/\s+/)[0].trim()

      let results = []
      if (saltKeyword.length >= 3) {
        const { data } = await supabase.rpc('search_medicines', {
          search_term: saltKeyword,
          only_jan: false
        })
        results = data || []
      }
      if (!results.length && brandKeyword.length >= 3) {
        const { data } = await supabase.rpc('search_medicines', {
          search_term: brandKeyword,
          only_jan: false
        })
        results = data || []
      }

      setScanMatches(results.slice(0, 10))
      setScanStatus('Scan & generic matching complete.')
    } catch {
      setScanStatus('Could not process image. Please try a clearer, well-lit photo.')
    }
  }

  async function submitReport(e) {
    e.preventDefault()
    if (!user) return setReportMsg('Please sign in to submit an official report.')
    const { error } = await supabase.from('reports').insert({
      user_id: user.id,
      ...reportForm
    })
    if (error) setReportMsg(error.message)
    else {
      setReportMsg('Report logged in database. Thank you for helping keep patients safe.')
      setReportForm({ medicine_name: '', batch_no: '', pharmacy_name: '', description: '' })
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Strip Scanner & Batch Verification</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Snap a photo of any medicine strip to identify its salt & cheaper Jan Aushadhi alternatives, scan H2 QR codes, or check CDSCO recalls.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-slate-200/70 p-1 rounded-xl text-xs sm:text-sm font-semibold">
        <button
          onClick={() => { stopQrScan(); setTab('ocr') }}
          className={`py-2 rounded-lg transition ${tab === 'ocr' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'}`}
        >
          AI Strip Photo
        </button>
        <button
          onClick={() => { stopQrScan(); setTab('batch') }}
          className={`py-2 rounded-lg transition ${tab === 'batch' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'}`}
        >
          Batch & Expiry
        </button>
        <button
          onClick={() => setTab('qr')}
          className={`py-2 rounded-lg transition ${tab === 'qr' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'}`}
        >
          H2 QR Scan
        </button>
      </div>

      {tab === 'ocr' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <label className="border-2 border-dashed border-teal-300 bg-teal-50/40 hover:bg-teal-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition">
            <Camera className="w-8 h-8 text-teal-600 mb-2" />
            <span className="font-bold text-sm text-slate-900">Take Photo or Upload Medicine Strip</span>
            <span className="text-xs text-slate-500 mt-1">Gemini Vision AI reads brand name, salt composition, and Schedule H warnings</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleStripPhoto} className="hidden" />
          </label>

          {previewUrl && (
            <img src={previewUrl} alt="Scanned strip" className="max-h-48 rounded-xl mx-auto border border-slate-200 object-contain" />
          )}

          {scanStatus && (
            <p className="text-xs font-semibold text-teal-700 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" /> {scanStatus}
            </p>
          )}

          {aiScanData && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">{aiScanData.brand_name}</h2>
                {aiScanData.schedule_warning && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
                    {aiScanData.schedule_warning}
                  </span>
                )}
              </div>
              <p className="text-teal-700 font-semibold text-sm">{aiScanData.salt_composition}</p>
              <p className="text-slate-600"><strong>Manufacturer:</strong> {aiScanData.manufacturer}</p>
              <p className="text-slate-700">{aiScanData.summary}</p>
              <p className="text-slate-500 italic">{aiScanData.authenticity_notes}</p>
            </div>
          )}

          {scanMatches.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-sm text-slate-900">Matching Database Options & Jan Aushadhi Generics</h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {scanMatches.map((m) => (
                  <Link key={m.id} to={`/medicine/${m.id}`} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">{m.brand_name}</span>
                        {m.is_jan_aushadhi && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" /> Jan Aushadhi
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">{m.salt_name} • {m.pack_size}</span>
                    </div>
                    <span className="font-bold text-sm text-teal-800">₹{Number(m.official_mrp).toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'batch' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <form onSubmit={checkBatch} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Batch Number (Printed on strip edge)</label>
              <input
                type="text"
                required
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder="Try sample alert: PCT-2409A or PNT-8812"
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Expiry Date (Optional)</label>
              <input
                type="date"
                value={expiryInput}
                onChange={(e) => setExpiryInput(e.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" /> Check CDSCO Alert Database
            </button>
          </form>

          {batchResult && (
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              {batchResult.isExpired && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>Expired Medicine:</strong> The entered expiry date has already passed. Do not consume.</span>
                </div>
              )}
              {batchResult.alerts.length > 0 ? (
                batchResult.alerts.map((a) => (
                  <div key={a.id} className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-950 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-700">
                      <ShieldAlert className="w-4 h-4" /> CDSCO NSQ RECALL ALERT — BATCH {a.batch_no}
                    </div>
                    <p><strong>Medicine:</strong> {a.medicine_name} ({a.manufacturer})</p>
                    <p><strong>Reason:</strong> {a.reason}</p>
                  </div>
                ))
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>No CDSCO NSQ recall alert found for batch <strong>{batchResult.checkedBatch}</strong>. Always verify seal integrity and MRP.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'qr' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-center">
          <div id="qr-reader" className="max-w-xs mx-auto overflow-hidden rounded-xl" />
          {!scanningQr ? (
            <button onClick={startQrScan} className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700">
              Start Camera QR Scan
            </button>
          ) : (
            <button onClick={stopQrScan} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold">
              Stop Scanner
            </button>
          )}
          {qrResult && (
            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-left break-all">
              <strong className="text-teal-900 block mb-1">Decoded QR Payload:</strong>
              {qrResult}
            </div>
          )}
        </div>
      )}

      <form onSubmit={submitReport} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <FileWarning className="w-4 h-4 text-amber-600" />
          <span>Report Suspected Substandard / Counterfeit Batch</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input required placeholder="Medicine Name" value={reportForm.medicine_name} onChange={(e) => setReportForm({ ...reportForm, medicine_name: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-300 text-xs" />
          <input required placeholder="Batch Number" value={reportForm.batch_no} onChange={(e) => setReportForm({ ...reportForm, batch_no: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-300 text-xs" />
        </div>
        <input placeholder="Pharmacy / Store Name & City" value={reportForm.pharmacy_name} onChange={(e) => setReportForm({ ...reportForm, pharmacy_name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs" />
        <textarea required rows={2} placeholder="Describe issue (spelling error, broken seal, no QR, side effect)..." value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs" />
        {reportMsg && <p className="text-xs font-medium text-teal-700">{reportMsg}</p>}
        <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
          Submit Report
        </button>
      </form>
    </div>
  )
}
