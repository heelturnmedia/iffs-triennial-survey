import { useState, useCallback, useMemo } from 'react'
import ReactMap, { Source, Layer, Popup, NavigationControl } from 'react-map-gl'
import type { MapLayerMouseEvent } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

declare const window: Window & { __env?: Record<string, string> }
const MAPBOX_TOKEN = (
  (typeof window !== 'undefined' && window.__env?.VITE_MAPBOX_TOKEN) ||
  import.meta.env.VITE_MAPBOX_TOKEN ||
  ''
) as string

const SOURCE_URL   = 'mapbox://mapbox.country-boundaries-v1'
const SOURCE_LAYER = 'country_boundaries'
const LAYER_FILL   = 'iffs-answer-fills'
const NO_DATA      = 'rgba(0,0,0,0)'

// Sequential single-hue ramp (light → dark green) — magnitude, per dataviz.
const RAMP = ['#e8f5ec', '#b7dcc1', '#7bc194', '#3f9e63', '#1d7733', '#0e5921']
function rampColor(t: number): string {
  const i = Math.min(RAMP.length - 1, Math.max(0, Math.round(t * (RAMP.length - 1))))
  return RAMP[i]
}

export interface AnswerChoroplethMapProps {
  // iso2 (uppercase) → value in 0..1 (e.g. answer prevalence)
  isoValue: Map<string, number>
  // iso2 → { name, n, count } for the hover popup
  isoDetail: Map<string, { name: string; n: number; count: number }>
  answerLabel: string
  height?: string | number
}

export function AnswerChoroplethMap({
  isoValue,
  isoDetail,
  answerLabel,
  height = 380,
}: AnswerChoroplethMapProps) {
  const [popup, setPopup] = useState<{ lng: number; lat: number; name: string; pct: number; n: number } | null>(null)

  const fillExpr = useMemo(() => {
    const expr: unknown[] = ['match', ['get', 'iso_3166_1']]
    isoValue.forEach((v, iso) => {
      const c = rampColor(v)
      expr.push(iso, c)
      expr.push(iso.toLowerCase(), c)
    })
    if (isoValue.size === 0) expr.push('__none__', NO_DATA)
    expr.push(NO_DATA)
    return expr
  }, [isoValue])

  // Track the country under the cursor as it moves across the map (onMouseMove,
  // not onMouseEnter — the latter fires once per layer entry and won't update
  // when sweeping between adjacent countries).
  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const iso = (e.features?.[0]?.properties?.iso_3166_1 as string | undefined)?.toUpperCase()
    if (!iso) { setPopup(null); return }
    const d = isoDetail.get(iso)
    if (!d) { setPopup(null); return }
    setPopup({ lng: e.lngLat.lng, lat: e.lngLat.lat, name: d.name, pct: d.n ? d.count / d.n : 0, n: d.n })
  }, [isoDetail])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center rounded-2xl p-10 text-center"
        style={{ height, background: 'var(--s2)', border: '1.5px dashed var(--bd2)' }}>
        <p className="font-body text-[12px] text-[#7a8a96]">Mapbox token not configured.</p>
      </div>
    )
  }

  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative', border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
      <ReactMap
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: 20, latitude: 15, zoom: 1.5 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        interactiveLayerIds={[LAYER_FILL]}
        onMouseMove={onMove}
        onMouseLeave={() => setPopup(null)}
        cursor={popup ? 'pointer' : 'default'}
      >
        <Source id="iffs-answer-countries" type="vector" url={SOURCE_URL}>
          <Layer
            id={LAYER_FILL}
            type="fill"
            source-layer={SOURCE_LAYER}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paint={{ 'fill-color': fillExpr as any, 'fill-opacity': 0.85 }}
          />
          <Layer id="iffs-answer-lines" type="line" source-layer={SOURCE_LAYER}
            paint={{ 'line-color': 'rgba(255,255,255,0.4)', 'line-width': 0.5 }} />
        </Source>
        <NavigationControl position="top-right" showCompass={false} />
        {popup && (
          <Popup longitude={popup.lng} latitude={popup.lat} closeButton={false} anchor="bottom" offset={8}>
            <div style={{ fontFamily: 'var(--font-body)', minWidth: 150 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#0d1117', marginBottom: 4 }}>
                {popup.name}
              </div>
              <div style={{ fontSize: 12, color: '#1d7733', fontWeight: 700 }}>
                {Math.round(popup.pct * 100)}% <span style={{ color: '#7a8a96', fontWeight: 400 }}>chose "{answerLabel}"</span>
              </div>
              <div style={{ fontSize: 11, color: '#b0bec5', marginTop: 2 }}>{popup.n} respondent{popup.n !== 1 ? 's' : ''}</div>
            </div>
          </Popup>
        )}
      </ReactMap>

      {/* Sequential legend */}
      <div className="absolute bottom-4 left-4 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid var(--bd)', pointerEvents: 'none' }}>
        <div className="uppercase mb-1.5" style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#7a8a96' }}>
          % choosing "{answerLabel}"
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {RAMP.map((c) => <div key={c} style={{ width: 20, height: 10, background: c }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: '#7a8a96' }}>0%</span>
          <span style={{ fontSize: 9, color: '#7a8a96' }}>100%</span>
        </div>
      </div>
    </div>
  )
}
