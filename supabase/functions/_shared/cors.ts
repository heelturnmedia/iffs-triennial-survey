// Restrict cross-origin calls to the app's own origins. The previous '*'
// allowed any website to invoke these functions from a victim's browser.
const ALLOWED_ORIGINS = new Set([
  'https://iffssurvey.com',
  'https://www.iffssurvey.com',
  'http://localhost:5173', // Vite dev server
])

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin)
      ? origin
      : 'https://iffssurvey.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) })
  }
  return null
}
