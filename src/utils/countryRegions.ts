// ─────────────────────────────────────────────────────────────────────────────
// Country / Region utilities
// ─────────────────────────────────────────────────────────────────────────────

export type Region =
  | 'Africa'
  | 'Americas'
  | 'Asia'
  | 'Europe'
  | 'Oceania'
  | 'Unknown'

// Mapping: ISO 3166-1 alpha-2 → Region
const ISO2_TO_REGION: Record<string, Region> = {
  // Africa
  DZ: 'Africa', AO: 'Africa', BJ: 'Africa', BW: 'Africa', BF: 'Africa',
  BI: 'Africa', CV: 'Africa', CM: 'Africa', CF: 'Africa', TD: 'Africa',
  KM: 'Africa', CG: 'Africa', CD: 'Africa', CI: 'Africa', DJ: 'Africa',
  EG: 'Africa', GQ: 'Africa', ER: 'Africa', SZ: 'Africa', ET: 'Africa',
  GA: 'Africa', GM: 'Africa', GH: 'Africa', GN: 'Africa', GW: 'Africa',
  KE: 'Africa', LS: 'Africa', LR: 'Africa', LY: 'Africa', MG: 'Africa',
  MW: 'Africa', ML: 'Africa', MR: 'Africa', MU: 'Africa', MA: 'Africa',
  MZ: 'Africa', NA: 'Africa', NE: 'Africa', NG: 'Africa', RW: 'Africa',
  ST: 'Africa', SN: 'Africa', SL: 'Africa', SO: 'Africa', ZA: 'Africa',
  SS: 'Africa', SD: 'Africa', TZ: 'Africa', TG: 'Africa', TN: 'Africa',
  UG: 'Africa', ZM: 'Africa', ZW: 'Africa',

  // Americas
  AG: 'Americas', AR: 'Americas', BS: 'Americas', BB: 'Americas', BZ: 'Americas',
  BO: 'Americas', BR: 'Americas', CA: 'Americas', CL: 'Americas', CO: 'Americas',
  CR: 'Americas', CU: 'Americas', DM: 'Americas', DO: 'Americas', EC: 'Americas',
  SV: 'Americas', GD: 'Americas', GT: 'Americas', GY: 'Americas', HT: 'Americas',
  HN: 'Americas', JM: 'Americas', MX: 'Americas', NI: 'Americas', PA: 'Americas',
  PY: 'Americas', PE: 'Americas', KN: 'Americas', LC: 'Americas', VC: 'Americas',
  SR: 'Americas', TT: 'Americas', US: 'Americas', UY: 'Americas', VE: 'Americas',

  // Asia
  AF: 'Asia', AM: 'Asia', AZ: 'Asia', BH: 'Asia', BD: 'Asia', BT: 'Asia',
  BN: 'Asia', KH: 'Asia', CN: 'Asia', CY: 'Asia', GE: 'Asia', IN: 'Asia',
  ID: 'Asia', IR: 'Asia', IQ: 'Asia', IL: 'Asia', JP: 'Asia', JO: 'Asia',
  KZ: 'Asia', KW: 'Asia', KG: 'Asia', LA: 'Asia', LB: 'Asia', MY: 'Asia',
  MV: 'Asia', MN: 'Asia', MM: 'Asia', NP: 'Asia', KP: 'Asia', OM: 'Asia',
  PK: 'Asia', PS: 'Asia', PH: 'Asia', QA: 'Asia', SA: 'Asia', SG: 'Asia',
  KR: 'Asia', LK: 'Asia', SY: 'Asia', TW: 'Asia', TJ: 'Asia', TH: 'Asia',
  TL: 'Asia', TM: 'Asia', AE: 'Asia', UZ: 'Asia', VN: 'Asia', YE: 'Asia',

  // Europe
  AL: 'Europe', AD: 'Europe', AT: 'Europe', BY: 'Europe', BE: 'Europe',
  BA: 'Europe', BG: 'Europe', HR: 'Europe', CZ: 'Europe', DK: 'Europe',
  EE: 'Europe', FI: 'Europe', FR: 'Europe', DE: 'Europe', GR: 'Europe',
  HU: 'Europe', IS: 'Europe', IE: 'Europe', IT: 'Europe', XK: 'Europe',
  LV: 'Europe', LI: 'Europe', LT: 'Europe', LU: 'Europe', MT: 'Europe',
  MD: 'Europe', MC: 'Europe', ME: 'Europe', NL: 'Europe', MK: 'Europe',
  NO: 'Europe', PL: 'Europe', PT: 'Europe', RO: 'Europe', RU: 'Europe',
  SM: 'Europe', RS: 'Europe', SK: 'Europe', SI: 'Europe', ES: 'Europe',
  SE: 'Europe', CH: 'Europe', TR: 'Europe', UA: 'Europe', GB: 'Europe',
  VA: 'Europe',

  // Oceania
  AU: 'Oceania', FJ: 'Oceania', KI: 'Oceania', MH: 'Oceania', FM: 'Oceania',
  NR: 'Oceania', NZ: 'Oceania', PW: 'Oceania', PG: 'Oceania', WS: 'Oceania',
  SB: 'Oceania', TO: 'Oceania', TV: 'Oceania', VU: 'Oceania',
}

// Country name → ISO 3166-1 alpha-2 (common names used in survey)
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR',
  'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Bahrain': 'BH', 'Bangladesh': 'BD', 'Belgium': 'BE', 'Bolivia': 'BO',
  'Bosnia and Herzegovina': 'BA', 'Brazil': 'BR', 'Bulgaria': 'BG',
  'Cambodia': 'KH', 'Canada': 'CA', 'Chile': 'CL', 'China': 'CN',
  'Colombia': 'CO', 'Costa Rica': 'CR', 'Croatia': 'HR', 'Cuba': 'CU',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Denmark': 'DK', 'Ecuador': 'EC',
  'Egypt': 'EG', 'El Salvador': 'SV', 'Estonia': 'EE', 'Ethiopia': 'ET',
  'Finland': 'FI', 'France': 'FR', 'Georgia': 'GE', 'Germany': 'DE',
  'Ghana': 'GH', 'Greece': 'GR', 'Guatemala': 'GT', 'Honduras': 'HN',
  'Hungary': 'HU', 'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID',
  'Iran': 'IR', 'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL',
  'Italy': 'IT', 'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ',
  'Kenya': 'KE', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG', 'Latvia': 'LV',
  'Lebanon': 'LB', 'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malaysia': 'MY',
  'Mexico': 'MX', 'Moldova': 'MD', 'Mongolia': 'MN', 'Morocco': 'MA',
  'Myanmar': 'MM', 'Nepal': 'NP', 'Netherlands': 'NL', 'New Zealand': 'NZ',
  'Nicaragua': 'NI', 'Nigeria': 'NG', 'Norway': 'NO', 'Oman': 'OM',
  'Pakistan': 'PK', 'Panama': 'PA', 'Paraguay': 'PY', 'Peru': 'PE',
  'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA',
  'Romania': 'RO', 'Russia': 'RU', 'Russian Federation': 'RU',
  'Saudi Arabia': 'SA', 'Serbia': 'RS', 'Singapore': 'SG', 'Slovakia': 'SK',
  'Slovenia': 'SI', 'South Africa': 'ZA', 'South Korea': 'KR',
  'Republic of Korea': 'KR', 'Spain': 'ES', 'Sri Lanka': 'LK',
  'Sweden': 'SE', 'Switzerland': 'CH', 'Syria': 'SY', 'Taiwan': 'TW',
  'Tajikistan': 'TJ', 'Tanzania': 'TZ', 'Thailand': 'TH', 'Tunisia': 'TN',
  'Turkey': 'TR', 'Türkiye': 'TR', 'Uganda': 'UG', 'Ukraine': 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB',
  'United States': 'US', 'United States of America': 'US',
  'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Venezuela': 'VE',
  'Vietnam': 'VN', 'Yemen': 'YE', 'Zimbabwe': 'ZW',
}

/** Return the region for a given ISO 3166-1 alpha-2 code. */
export function getRegion(iso2: string): Region {
  return ISO2_TO_REGION[iso2.toUpperCase()] ?? 'Unknown'
}

/** Convert a country name string to ISO 3166-1 alpha-2 code. */
export function countryNameToIso2(name: string): string {
  if (!name) return ''
  const direct = COUNTRY_NAME_TO_ISO2[name]
  if (direct) return direct
  // Case-insensitive fallback
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(COUNTRY_NAME_TO_ISO2)) {
    if (key.toLowerCase() === lower) return val
  }
  return ''
}

/**
 * Resolve any country value (string name, ISO2 code, or SurveyJS choicesByUrl
 * object) to an ISO 3166-1 alpha-2 code.
 *
 * SurveyJS stores the entire choice object from choicesByUrl when no valueName
 * is configured. The CountriesExample API returns objects with a `cca2` field
 * which is the ISO2 code directly.
 */
export function resolveCountryToIso2(value: unknown): string {
  if (!value) return ''

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // Prefer cca2 (ISO2 directly from the SurveyJS CountriesExample API)
    if (obj['cca2'] && typeof obj['cca2'] === 'string') return obj['cca2'].toUpperCase()
    // Fall back to name lookup
    const name = String(obj['name'] ?? '')
    return countryNameToIso2(name)
  }

  const str = String(value).trim()
  if (!str) return ''
  // Already a 2-letter ISO2 code
  if (str.length === 2) return str.toUpperCase()
  return countryNameToIso2(str)
}

/**
 * Extract a human-readable country name from any country value (string or
 * SurveyJS choicesByUrl object).
 */
export function resolveCountryName(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return String(obj['name'] ?? obj['cca2'] ?? '')
  }
  return String(value)
}
