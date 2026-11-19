const MODELS = ['gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
  }

  try {
    const { mode, query, imageBase64, mimeType, matchedMedicines } = req.body

    let prompt = ''
    const parts = []

    if (mode === 'scan' && imageBase64) {
      prompt = `You are MediVerify AI, an Indian clinical pharmacy assistant.
Analyze this medicine strip/pack image and return ONLY valid JSON (no markdown fences) with this exact schema:
{
  "brand_name": "Detected brand name (e.g. Dolo 650, Augmentin 625)",
  "salt_composition": "Exact active generic salt + strength (e.g. Paracetamol 650mg)",
  "manufacturer": "Manufacturer name if visible or 'Unknown'",
  "schedule_warning": "Schedule H / H1 / OTC / NRx warning if visible",
  "authenticity_notes": "Brief check on packaging print clarity, batch/MRP presence",
  "summary": "2-sentence patient-friendly explanation of what this medicine treats and key precaution"
}`
      parts.push({ text: prompt })
      parts.push({
        inline_data: {
          mime_type: mimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
        }
      })
    } else {
      prompt = `You are MediVerify AI, an Indian clinical pharmacy & Jan Aushadhi (PMBJP) advisor.
User searched: "${query}"
Database matches found: ${JSON.stringify((matchedMedicines || []).slice(0, 6))}

Return ONLY valid JSON (no markdown fences) with this exact schema:
{
  "identified_salt": "Primary generic salt composition",
  "clinical_use": "What condition this medicine is prescribed for in simple terms",
  "bioequivalence_note": "Clear explanation comparing the branded medicine and PMBJP Jan Aushadhi generic (same active API, CDSCO quality standards)",
  "safety_warnings": "Key contraindications, dosage caution, or Schedule H prescription warning",
  "recommended_action": "Actionable advice on switching to the Jan Aushadhi generic or consulting a pharmacist"
}`
      parts.push({ text: prompt })
    }

    let lastError = 'Gemini API error'
    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        }
      )

      const data = await response.json()
      if (response.ok) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        return res.status(200).json(JSON.parse(rawText))
      }

      lastError = data.error?.message || lastError
      if (!/no longer available|not found|deprecated/i.test(lastError)) {
        return res.status(response.status).json({ error: lastError })
      }
    }

    return res.status(502).json({ error: lastError })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
