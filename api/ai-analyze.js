export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel Environment Variables. Add it and Redeploy.' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8500)

  try {
    const { mode, query, imageBase64, mimeType, matchedMedicines } = req.body || {}
    const parts = []

    if (mode === 'scan' && imageBase64) {
      parts.push({
        text: `You are MediVerify AI, an Indian clinical pharmacy assistant.
Analyze this medicine strip/pack image and return ONLY valid JSON with this exact schema:
{
  "brand_name": "Detected brand name (e.g. Dolo 650, Augmentin 625)",
  "salt_composition": "Exact active generic salt + strength (e.g. Paracetamol 650mg)",
  "manufacturer": "Manufacturer name if visible or 'Unknown'",
  "schedule_warning": "Schedule H / H1 / OTC / NRx warning if visible",
  "authenticity_notes": "Brief check on packaging print clarity, batch/MRP presence",
  "summary": "2-sentence patient-friendly explanation of what this medicine treats and key precaution"
}`
      })
      parts.push({
        inline_data: {
          mime_type: mimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
        }
      })
    } else {
      parts.push({
        text: `You are MediVerify AI, an Indian clinical pharmacy & Jan Aushadhi (PMBJP) advisor.
User searched: "${query}"
Database matches: ${JSON.stringify((matchedMedicines || []).slice(0, 5))}

Return ONLY valid JSON with this exact schema:
{
  "identified_salt": "Primary generic salt composition",
  "clinical_use": "What condition this medicine is prescribed for in simple terms",
  "bioequivalence_note": "Clear explanation comparing the branded medicine and PMBJP Jan Aushadhi generic (same active API, CDSCO quality standards)",
  "safety_warnings": "Key contraindications, dosage caution, or Schedule H prescription warning",
  "recommended_action": "Actionable advice on switching to the Jan Aushadhi generic or consulting a pharmacist"
}`
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      }
    )

    clearTimeout(timeout)
    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Gemini API returned HTTP ${response.status}`
      })
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return res.status(200).json(JSON.parse(rawText))
  } catch (err) {
    clearTimeout(timeout)
    const msg = err.name === 'AbortError'
      ? 'AI request timed out after 8.5s. Try a smaller/clearer photo or retry.'
      : (err.message || 'Server error')
    return res.status(500).json({ error: msg })
  }
}
