import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, Camera, ShieldAlert, CheckCircle2, Search, FileWarning } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { createWorker } from 'tesseract.js'
import { supabase } from '../lib/supabase'

export default function Verify({ user }) {
  const [tab, setTab] = useState('batch') // 'batch' | 'qr' | 'ocr'
  const [batchInput, setBatchInput] = useState('')
  const [expiryInput, setExpiryInput] = useState('')
  const [batchResult, setBatchResult] = useState(null)

  const [qrResult, setQrResult] = useState('')
  const [scanningQr, setScanningQr] = useState(false)
  const qrScannerRef = useRef(null)

  const [ocrStatus, setOcrStatus] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrMatches, setOcrMatches] = useState([])

  const [reportForm, setReportForm] = useState({ medicine_name: '', batch_no: '', pharmacy_name: '', description: '' })
  const [reportMsg, setReportMsg] = useState('')

  // 1. CDSCO NSQ Batch & Expiry Check
  async function checkBatch(e) {
    if (e) e.preventDefault()
    if (!batchInput.trim()) return

    const { data } = await supabase
      .from('nsq_alerts')
      .select('*')
      .ilike('batch_no', `%${batchInput.trim()}%`)

    let isExpired = false
    if (expiryInput) {
      isExpired = new Date(expiryInput) < new Date()
    }

    setBatchResult({
      alerts: data || [],
      isExpired,
      checkedBatch: batchInput.trim().toUpperCase()
    })
  }

  // 2. Schedule H2 QR / Barcode Scanner
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
    } catch (err) {
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

  // 3. Strip Photo OCR (Tesseract.js)
  async function handleStripPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrStatus('Reading medicine strip text...')
    setOcrText('')
    setOcrMatches([])

    try {
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      setOcrText(text)
      setOcrStatus('Matching extracted text with database...')

      const words = [...new Set(text.match(/[A-Za-z]{4,}/g) || [])].slice(0, 12)
      if (words.length > 0) {
        const orFilter = words.map((w) => `brand_name.ilike.%${w}%`).join(',')
        const { data: matches } = await supabase
          .from('medicines')
          .select('*, salts(salt_name)')
          .or(orFilter)
          .limit(6)
        setOcrMatches(matches || [])
      }
      setOcrStatus('Scan complete.')
    } catch {
      setOcrStatus('Could not process image. Try a clearer, well-lit photo.')
    }
  }

  // 4. Submit Fake Medicine Report to Supabase
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
        <h1 className="text-2xl font-bold text-slate-900">Verify Medicine & Strip Lens</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Cross-check batch numbers against CDSCO NSQ recall alerts, scan Schedule H2 QR codes, or read a medicine strip photo.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-3 gap-2 bg-slate-200/70 p-1 rounded-xl text-xs sm:text-sm font-semibold">
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
        <button
          onClick={() => { stopQrScan(); setTab('ocr') }}
          className={`py-2 rounded-lg transition ${tab === 'ocr' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'}`}
        >
          Strip Photo OCR
        </button>
      </div>

      {/* TAB 1: Batch & Expiry Check */}
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
                batchResult.alerts.map((alert) => (
                  <div key={alert.id} className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-950 text-xs space-y-1">
                    <div className="font-bold text-sm flex items-center gap-1.5 text-red-700">
                      <ShieldAlert className="w-4 h-4" /> CDSCO NSQ Alert Match Found!
                    </div>
                    <p><strong>Drug:</strong> {alert.drug_name}</p>
                    <p><strong>Batch No:</strong> {alert.batch_no}</p>
                    <p><strong>Manufacturer:</strong> {alert.manufacturer}</p>
                    <p><strong>Reason:</strong> {alert.reason} ({alert.alert_month})</p>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-sm">No CDSCO NSQ Recall Found for "{batchResult.checkedBatch}"</p>
                    <p className="mt-0.5 text-emerald-800">Always verify packaging seal quality, hologram/QR code, and purchase with a valid GST bill.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Schedule H2 QR Scanner */}
      {tab === 'qr' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Top 300 Indian medicine brands carry a Schedule H2 QR code on the pack/strip containing GTIN, Batch No, and Expiry.
          </p>
          <div id="qr-reader" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-slate-100" />
          <div className="flex justify-center gap-3">
            {!scanningQr ? (
              <button
                onClick={startQrScan}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold flex items-center gap-2"
              >
                <ScanLine className="w-4 h-4" /> Start Camera QR Scan
              </button>
            ) : (
              <button
                onClick={stopQrScan}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold"
              >
                Stop Camera
              </button>
            )}
          </div>
          {qrResult && (
            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-950 break-all">
              <strong>Decoded QR Payload:</strong> {qrResult}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Strip Photo OCR */}
      {tab === 'ocr' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <label className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-teal-500">
            <Camera className="w-8 h-8 text-teal-600 mb-2" />
            <span className="text-sm font-semibold text-slate-800">Take Photo or Upload Medicine Strip</span>
            <span className="text-xs text-slate-500 mt-1">Ensure brand name and salt text are well-lit and sharp</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleStripPhoto} className="hidden" />
          </label>

          {ocrStatus && <p className="text-xs font-medium text-teal-700">{ocrStatus}</p>}

          {ocrMatches.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-500">Matched Medicines in Database</h3>
              {ocrMatches.map((m) => (
                <Link
                  key={m.id}
                  to={`/medicine/${m.id}`}
                  className="block p-3 rounded-xl border border-slate-200 hover:border-teal-500 text-sm"
                >
                  <span className="font-bold text-slate-900">{m.brand_name}</span>
                  <span className="block text-xs text-teal-700">{m.salts?.salt_name} • ₹{m.official_mrp}</span>
                </Link>
              ))}
            </div>
          )}

          {ocrText && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium">View raw extracted strip text</summary>
              <pre className="mt-2 p-3 rounded-lg bg-slate-50 whitespace-pre-wrap">{ocrText}</pre>
            </details>
          )}
        </div>
      )}

      {/* Report Suspected Fake Medicine */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <FileWarning className="w-4 h-4 text-amber-600" /> Report Suspected Counterfeit / Substandard Medicine
        </h2>
        <form onSubmit={submitReport} className="grid sm:grid-cols-2 gap-3 text-sm">
          <input
            type="text"
            required
            placeholder="Medicine brand name"
            value={reportForm.medicine_name}
            onChange={(e) => setReportForm({ ...reportForm, medicine_name: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300"
          />
          <input
            type="text"
            placeholder="Batch number (if visible)"
            value={reportForm.batch_no}
            onChange={(e) => setReportForm({ ...reportForm, batch_no: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300"
          />
          <input
            type="text"
            placeholder="Pharmacy / Location"
            value={reportForm.pharmacy_name}
            onChange={(e) => setReportForm({ ...reportForm, pharmacy_name: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 sm:col-span-2"
          />
          <textarea
            required
            rows={2}
            placeholder="Describe issue (e.g. broken seal, spelling error, missing QR)"
            value={reportForm.description}
            onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-300 sm:col-span-2"
          />
          <button type="submit" className="sm:col-span-2 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800">
            Submit Report
          </button>
        </form>
        {reportMsg && <p className="text-xs text-teal-700 font-medium">{reportMsg}</p>}
      </div>
    </div>
  )
}
