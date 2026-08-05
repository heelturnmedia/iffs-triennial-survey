// ─────────────────────────────────────────────────────────────────────────────
// Guard: every country the survey offers must resolve to an ISO 3166-1 alpha-2
// code, and every code must map to a region.
//
// Why this exists: COUNTRY_CHOICES (the survey dropdown) and the lookup tables
// in countryRegions.ts are maintained by hand in separate files. They silently
// drifted apart — 85 of 193 choices had no mapping, so those respondents were
// dropped from the choropleth, the region filter and the Countries Data tab
// with no error anywhere. Nothing failed loudly; the data just wasn't there.
//
// Run: npm run verify:countries
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const choicesSrc = read('src/data/countries.ts')
const regionsSrc = read('src/utils/countryRegions.ts')

// COUNTRY_CHOICES is a flat list of double-quoted names.
const choices = [...choicesSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1])

// Both lookup tables are single object literals; slice each one out by name.
const sliceObject = (src, marker) => src.split(marker)[1].split('}')[0]
const nameToIso = new Map(
  [...sliceObject(regionsSrc, 'COUNTRY_NAME_TO_ISO2').matchAll(/'([^']+)'\s*:\s*'([A-Z]{2})'/g)]
    .map((m) => [m[1], m[2]]),
)
const isoToRegion = new Map(
  [...sliceObject(regionsSrc, 'ISO2_TO_REGION').matchAll(/([A-Z]{2})\s*:\s*'([A-Za-z]+)'/g)]
    .map((m) => [m[1], m[2]]),
)

const failures = []

const unmapped = choices.filter((c) => !nameToIso.has(c))
if (unmapped.length) {
  failures.push(
    `${unmapped.length} survey country choice(s) have no ISO 3166-1 mapping ` +
    `— these respondents would vanish from the map and reports:\n    ` +
    unmapped.join(', '),
  )
}

const regionless = [...new Set(choices.map((c) => nameToIso.get(c)).filter(Boolean))]
  .filter((iso) => !isoToRegion.has(iso) || isoToRegion.get(iso) === 'Unknown')
if (regionless.length) {
  failures.push(
    `${regionless.length} ISO code(s) have no region — the Region filter would ` +
    `silently exclude them: ${regionless.join(', ')}`,
  )
}

console.log(`countries offered by the survey : ${choices.length}`)
console.log(`name -> ISO 3166-1 mappings     : ${nameToIso.size}`)
console.log(`ISO -> region mappings          : ${isoToRegion.size}`)

if (failures.length) {
  console.error('\nFAILED\n  ' + failures.join('\n  '))
  process.exit(1)
}
console.log('\nOK — every survey country resolves to an ISO code and a region.')
