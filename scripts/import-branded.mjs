import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import readline from 'readline'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function parseCSV(line) {
  const res = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') inQ = !inQ
    else if (ch === ',' && !inQ) { res.push(cur.trim()); cur = '' }
    else cur += ch
  }
  res.push(cur.trim())
  return res
}

function normalizeSalt(str) {
  return str
    .toLowerCase()
    .replace(/amoxycillin/g, 'amoxicillin')
    .replace(/paracetamol/g, 'acetaminophen')
    .replace(/[^a-z0-9+]/g, '')
}

function cleanComp(raw) {
  return (raw || '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function run() {
  console.log('1/3 Loading existing PMBJP salts from Supabase...')
  let allSalts = [], from = 0
  while (true) {
    const { data, error } = await supabase.from('salts').select('id, salt_name').range(from, from + 999)
    if (error) throw error
    if (!data.length) break
    allSalts = allSalts.concat(data)
    from += 1000
  }

  const saltLookup = new Map()
  for (const s of allSalts) {
    saltLookup.set(normalizeSalt(s.salt_name), s.id)
  }
  console.log(`Loaded ${allSalts.length} existing salts.`)

  console.log('2/3 Parsing CSV and creating missing salts...')
  const rl = readline.createInterface({
    input: fs.createReadStream('scripts/indian_medicines.csv'),
    crlfDelay: Infinity
  })

  let isHeader = true
  const parsedRows = []
  const newSaltsMap = new Map()

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue }
    const cols = parseCSV(line)
    const brandName = cols[1]
    const mrp = parseFloat((cols[2] || '').replace(/[^\d.]/g, ''))
    const discontinued = (cols[3] || '').toLowerCase() === 'true'
    const manufacturer = cols[4] || 'Indian Pharma'
    const category = cols[5] || 'Allopathy'
    const packSize = cols[6] || "10's"
    const comp1 = cleanComp(cols[7])
    const comp2 = cleanComp(cols[8])

    if (!brandName || discontinued || isNaN(mrp) || mrp <= 0 || !comp1) continue

    const fullSalt = comp2 ? `${comp1} + ${comp2}` : comp1
    const normKey = normalizeSalt(fullSalt)

    if (!saltLookup.has(normKey) && !newSaltsMap.has(normKey)) {
      newSaltsMap.set(normKey, {
        salt_name: fullSalt,
        category,
        indications: `Standard clinical formulation containing ${fullSalt}.`,
        side_effects: 'Refer to standard pharmacopoeia or prescribing physician.',
        warnings: 'Use only under medical supervision.',
        clinical_source: 'Indian Pharmaceutical Catalog'
      })
    }

    parsedRows.push({ normKey, brandName, manufacturer, packSize, mrp })
  }

  const newSaltsList = Array.from(newSaltsMap.entries())
  console.log(`Upserting ${newSaltsList.length} additional salts...`)

  for (let i = 0; i < newSaltsList.length; i += 500) {
    const chunk = newSaltsList.slice(i, i + 500).map(([, obj]) => obj)
    const { data, error } = await supabase
      .from('salts')
      .upsert(chunk, { onConflict: 'salt_name' })
      .select('id, salt_name')
    if (error) { console.error('Salt batch warning:', error.message); continue }
    for (const row of data) {
      saltLookup.set(normalizeSalt(row.salt_name), row.id)
    }
  }

  console.log(`3/3 Bulk inserting ${parsedRows.length} branded medicines...`)
  let totalInserted = 0
  for (let i = 0; i < parsedRows.length; i += 1000) {
    const batch = parsedRows
      .slice(i, i + 1000)
      .filter((r) => saltLookup.has(r.normKey))
      .map((r) => ({
        salt_id: saltLookup.get(r.normKey),
        brand_name: r.brandName,
        manufacturer: r.manufacturer,
        is_jan_aushadhi: false,
        pack_size: r.packSize,
        official_mrp: r.mrp,
        price_source: 'Indian Branded Pharma Catalog'
      }))

    if (!batch.length) continue
    const { error } = await supabase.from('medicines').insert(batch)
    if (error) console.error('\nMed batch error:', error.message)
    else totalInserted += batch.length
    process.stdout.write(`\rInserted ${totalInserted} / ${parsedRows.length} medicines...`)
  }

  console.log(`\n🎉 Done! Imported ${totalInserted} branded Indian medicines!`)
}

run()
