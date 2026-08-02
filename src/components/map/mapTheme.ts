// ─────────────────────────────────────────────────────────────────────────────
// Shared Mapbox theme — colour ramps and water styling used by every map in
// the app (Reports → Overview choropleth, Insights, Countries Data), so the
// palette can never drift between them.
// ─────────────────────────────────────────────────────────────────────────────

/** Submitted: light tint → full brand green. */
export const GREEN_LIGHT = '#c5e1cc'
export const GREEN_DARK  = '#1d7733'

/** In progress: light amber → full amber. */
export const AMBER_LIGHT = '#fbe575'
export const AMBER_DARK  = '#f5d010'

/** Countries with no response — unchanged. */
export const NO_RESPONSE_FILL   = 'rgba(0,0,0,0)'
export const NO_RESPONSE_SWATCH = '#d4d8d0'

/** Water: shallow at zoom 1 → deep at max zoom. */
export const WATER_SHALLOW = '#39a3ea'
export const WATER_DEEP    = '#0268b1'

// Mapbox clamps outside the stop range, so zoom < 1 stays shallow and
// zoom > 22 (the engine maximum) stays deep.
export const WATER_COLOR_EXPR = [
  'interpolate', ['linear'], ['zoom'],
  1,  WATER_SHALLOW,
  22, WATER_DEEP,
] as const

// ── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Linear blend between two hex colours. `t` is clamped to 0..1. */
export function mixHex(from: string, to: string, t: number): string {
  const k = Math.min(1, Math.max(0, t))
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  const ch = (a: number, b: number) =>
    Math.round(a + (b - a) * k).toString(16).padStart(2, '0')
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`
}

/** Evenly spaced ramp between two colours — used for legends and bucketing. */
export function rampBetween(from: string, to: string, steps: number): string[] {
  return Array.from({ length: steps }, (_, i) =>
    mixHex(from, to, steps === 1 ? 1 : i / (steps - 1)),
  )
}

/** Sequential green ramp shared by the prevalence map and its legend. */
export const GREEN_RAMP = rampBetween(GREEN_LIGHT, GREEN_DARK, 6)

/**
 * Shade a country by how many responses it has: the lowest count takes the
 * light end of the ramp, the highest takes the dark end.
 *
 * The 0.25 floor keeps a single response clearly legible against the
 * basemap — a pure light tint at the bottom of the ramp reads as "no data".
 * When every country has the same count there is no ramp to speak of, so
 * they all take full strength rather than all rendering washed out.
 */
export function shadeByCount(count: number, max: number, from: string, to: string): string {
  if (count <= 0) return from
  const ratio = max > 1 ? (count - 1) / (max - 1) : 1
  return mixHex(from, to, 0.25 + 0.75 * ratio)
}

// ── Water styling ────────────────────────────────────────────────────────────

/**
 * Minimal structural type — avoids coupling to a mapbox-gl version's types.
 * `setPaintProperty` is declared with `any` for its property/value pair on
 * purpose: mapbox-gl types those as a 300-member literal union keyed by layer
 * type, which a generic helper iterating arbitrary layers cannot satisfy.
 * Layer id and type stay strongly typed.
 */
interface StyledMap {
  getStyle: () => { layers?: Array<{ id: string; type: string }> } | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPaintProperty: (layerId: string, property: any, value: any) => void
}

/**
 * Recolour oceans, seas and rivers with the zoom-graduated blue.
 *
 * Call from the map's `onLoad`. Only `fill` and `line` layers are touched —
 * light-v11 also ships `water-point-label` / `water-line-label` / `waterway-label`,
 * which are `symbol` layers whose "colour" is label text; recolouring those
 * would turn the map's labels blue.
 */
export function applyWaterTheme(map: StyledMap): void {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.type !== 'fill' && layer.type !== 'line') continue
    if (!/water/i.test(layer.id)) continue
    try {
      map.setPaintProperty(
        layer.id,
        layer.type === 'fill' ? 'fill-color' : 'line-color',
        WATER_COLOR_EXPR,
      )
    } catch {
      // A style revision could drop or retype a layer — never break the map
      // over cosmetics.
    }
  }
}
