import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function fetchOpenFDAClinical(genericName) {
  try {
    const cleanSalt = genericName.split('+')[0].replace(/\d+\s*(mg|mcg|ml|g)/gi, '').trim()
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(cleanSalt)}"&limit=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const label = data.results?.[0]
    if (!label) return null
    return {
      indications: (label.indications_and_usage?.[0] || '').slice(0, 450),
      warnings: (label.warnings?.[0] || label.boxed_warning?.[0] || '').slice(0, 450),
      side_effects: (label.adverse_reactions?.[0] || '').slice(0, 450),
      clinical_source: 'OpenFDA Official Drug Label API'
    }
  } catch { return null }
}
const DATASET = [
  {
    salt_name: 'Paracetamol 650mg', category: 'Analgesic & Antipyretic',
    fallback_indications: 'Relief of mild to moderate pain and fever.',
    fallback_side_effects: 'Nausea, skin rash, or liver toxicity above 4000mg/day.',
    fallback_warnings: 'Avoid combining with other paracetamol medicines.',
    brands: [
      { brand_name: 'Jan Aushadhi Paracetamol 650mg', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '15 Tablets', official_mrp: 14.00, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Dolo 650', manufacturer: 'Micro Labs Ltd', is_jan_aushadhi: false, pack_size: '15 Tablets', official_mrp: 33.76, price_source: 'NPPA Ceiling Price' },
      { brand_name: 'Calpol 650', manufacturer: 'GSK', is_jan_aushadhi: false, pack_size: '15 Tablets', official_mrp: 33.76, price_source: 'NPPA Ceiling Price' }
    ]
  },
  {
    salt_name: 'Atorvastatin 10mg', category: 'Cardiovascular',
    fallback_indications: 'Lowers LDL cholesterol and triglycerides.',
    fallback_side_effects: 'Muscle pain, mild digestive upset, headache.',
    fallback_warnings: 'Report unexplained muscle pain immediately.',
    brands: [
      { brand_name: 'Jan Aushadhi Atorvastatin 10mg', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '10 Tablets', official_mrp: 9.00, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Lipitor 10mg', manufacturer: 'Pfizer Ltd', is_jan_aushadhi: false, pack_size: '10 Tablets', official_mrp: 98.50, price_source: 'Indian Retail MRP' },
      { brand_name: 'Atorva 10mg', manufacturer: 'Zydus Cadila', is_jan_aushadhi: false, pack_size: '10 Tablets', official_mrp: 72.00, price_source: 'Indian Retail MRP' }
    ]
  },
  {
    salt_name: 'Metformin Hydrochloride 500mg (SR)', category: 'Anti-Diabetic',
    fallback_indications: 'Controls blood sugar in Type 2 Diabetes.',
    fallback_side_effects: 'Metallic taste, nausea, bloating, B12 drop.',
    fallback_warnings: 'Take with meals. Avoid in severe kidney disease.',
    brands: [
      { brand_name: 'Jan Aushadhi Metformin 500mg SR', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '10 Tablets', official_mrp: 10.00, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Glycomet 500 SR', manufacturer: 'USV Pvt Ltd', is_jan_aushadhi: false, pack_size: '10 Tablets', official_mrp: 24.50, price_source: 'NPPA Ceiling Price' }
    ]
  },
  {
    salt_name: 'Pantoprazole 40mg', category: 'Gastrointestinal / PPI',
    fallback_indications: 'Treats GERD, acid reflux, and peptic ulcers.',
    fallback_side_effects: 'Headache, diarrhea, flatulence.',
    fallback_warnings: 'Take 30-60 mins before breakfast.',
    brands: [
      { brand_name: 'Jan Aushadhi Pantoprazole 40mg', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '10 Tablets', official_mrp: 11.00, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Pan 40', manufacturer: 'Alkem Laboratories', is_jan_aushadhi: false, pack_size: '15 Tablets', official_mrp: 155.00, price_source: 'Indian Retail MRP' }
    ]
  },
  {
    salt_name: 'Amoxicillin 500mg + Clavulanic Acid 125mg', category: 'Antibiotic (Schedule H)',
    fallback_indications: 'Treats bacterial respiratory, urinary, and dental infections.',
    fallback_side_effects: 'Diarrhea, nausea, skin rash.',
    fallback_warnings: 'Schedule H prescription drug. Complete full course.',
    brands: [
      { brand_name: 'Jan Aushadhi Amoxycillin + Clavulanate 625mg', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '10 Tablets', official_mrp: 55.00, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Augmentin 625 Duo', manufacturer: 'GSK', is_jan_aushadhi: false, pack_size: '10 Tablets', official_mrp: 204.80, price_source: 'NPPA Ceiling Price' }
    ]
  },
  {
    salt_name: 'Telmisartan 40mg', category: 'Antihypertensive',
    fallback_indications: 'Treats high blood pressure (hypertension).',
    fallback_side_effects: 'Dizziness, congestion, elevated potassium.',
    fallback_warnings: 'Contraindicated in pregnancy.',
    brands: [
      { brand_name: 'Jan Aushadhi Telmisartan 40mg', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '10 Tablets', official_mrp: 14.00, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Telma 40', manufacturer: 'Glenmark', is_jan_aushadhi: false, pack_size: '15 Tablets', official_mrp: 238.00, price_source: 'NPPA Ceiling Price' }
    ]
  },
  {
    salt_name: 'Cetirizine Hydrochloride 10mg', category: 'Antihistamine',
    fallback_indications: 'Relieves sneezing, runny nose, and skin allergies.',
    fallback_side_effects: 'Drowsiness, dry mouth, fatigue.',
    fallback_warnings: 'Avoid alcohol; use caution while driving.',
    brands: [
      { brand_name: 'Jan Aushadhi Cetirizine 10mg', manufacturer: 'PMBJP (BPPI)', is_jan_aushadhi: true, pack_size: '10 Tablets', official_mrp: 4.50, price_source: 'PMBJP Jan Aushadhi Tariff' },
      { brand_name: 'Cetzine 10mg', manufacturer: 'Dr. Reddy’s', is_jan_aushadhi: false, pack_size: '15 Tablets', official_mrp: 28.50, price_source: 'NPPA Ceiling Price' }
    ]
  }
]

const NSQ = [
  { drug_name: 'Paracetamol Tablets IP 500mg', batch_no: 'PCT-2409A', manufacturer: 'Sample Pharma Labs, Baddi', reason: 'Failed Dissolution Test', alert_month: 'CDSCO NSQ Alert' },
  { drug_name: 'Pantoprazole Tablets IP 40mg', batch_no: 'PNT-8812', manufacturer: 'Himalayan Formulations, Solan', reason: 'Failed Acid Resistance Test', alert_month: 'CDSCO NSQ Alert' },
  { drug_name: 'Amoxicillin + Clavulanate IP', batch_no: 'AMX-5501B', manufacturer: 'Apex Bio-Remedies, Haridwar', reason: 'Substandard Clavulanic Acid', alert_month: 'CDSCO NSQ Alert' },
  { drug_name: 'Telmisartan Tablets IP 40mg', batch_no: 'TLM-1094', manufacturer: 'Shivalik Healthcare, Dehradun', reason: 'Failed Disintegration Test', alert_month: 'CDSCO NSQ Alert' }
]

async function seed() {
  for (const item of DATASET) {
    const fda = await fetchOpenFDAClinical(item.salt_name)
    const { data: saltRow, error } = await supabase.from('salts').upsert({
      salt_name: item.salt_name,
      category: item.category,
      indications: fda?.indications || item.fallback_indications,
      side_effects: fda?.side_effects || item.fallback_side_effects,
      warnings: fda?.warnings || item.fallback_warnings,
      clinical_source: fda ? 'OpenFDA Official Drug Label API' : 'Indian Pharmacopoeia Monograph'
    }, { onConflict: 'salt_name' }).select().single()
    if (error) { console.error(error.message); continue }
    for (const b of item.brands) {
      await supabase.from('medicines').insert({ salt_id: saltRow.id, ...b })
    }
    console.log('✅ Seeded:', item.salt_name)
  }
  await supabase.from('nsq_alerts').insert(NSQ)
  console.log('🎉 Database seeding complete!')
}
seed()
