import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const csvPath = 'scripts/janaushadhi.csv'
if (!fs.existsSync(csvPath)) {
  console.error('❌ File not found at scripts/janaushadhi.csv')
  process.exit(1)
}

function parseCSVLine(line) {
  const result = []
  let cur = '', inQuotes = false
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

async function run() {
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean)
  const records = []

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line)
    // Columns: ['Sr No', 'Drug Code', 'Generic Name', 'Unit Size', 'MRP', 'Group Name']
    const saltName = cols[2]
    const packSize = cols[3] || "10's"
    const mrp = parseFloat((cols[4] || '').replace(/[^\d.]/g, ''))
    const category = cols[5] || 'General Medicine'

    if (!saltName || isNaN(mrp) || mrp <= 0) continue
    records.push({ saltName, packSize, mrp, category })
  }

  // 1. Deduplicate and bulk upsert salts
  const uniqueSalts = new Map()
  for (const r of records) {
    if (!uniqueSalts.has(r.saltName)) {
      uniqueSalts.set(r.saltName, {
        salt_name: r.saltName,
        category: r.category,
        indications: `Official PMBJP generic formulation for ${r.saltName}.`,
        side_effects: 'Refer to standard pharmacopoeia or prescribing physician.',
        warnings: 'Use only under medical supervision.',
        clinical_source: 'PMBJP Official Product Portfolio'
      })
    }
  }

  const saltList = Array.from(uniqueSalts.values())
  const saltIdMap = new Map()

  for (let i = 0; i < saltList.length; i += 250) {
    const chunk = saltList.slice(i, i + 250)
    const { data, error } = await supabase
      .from('salts')
      .upsert(chunk, { onConflict: 'salt_name' })
      .select('id, salt_name')
    if (error) { console.error('Salt batch error:', error.message); continue }
    for (const row of data) saltIdMap.set(row.salt_name, row.id)
  }

  // 2. Bulk insert Jan Aushadhi medicines
  const medRows = records
    .filter((r) => saltIdMap.has(r.saltName))
    .map((r) => ({
      salt_id: saltIdMap.get(r.saltName),
      brand_name: `Jan Aushadhi ${r.saltName}`,
      manufacturer: 'PMBJP (BPPI)',
      is_jan_aushadhi: true,
      pack_size: r.packSize,
      official_mrp: r.mrp,
      price_source: 'PMBJP Jan Aushadhi Official Tariff'
    }))

  let inserted = 0
  for (let i = 0; i < medRows.length; i += 250) {
    const chunk = medRows.slice(i, i + 250)
    const { error } = await supabase.from('medicines').insert(chunk)
    if (error) console.error('Med batch error:', error.message)
    else inserted += chunk.length
  }

  console.log(`🎉 Imported ${inserted} official PMBJP Jan Aushadhi medicines across ${saltIdMap.size} salts!`)
}

run()
