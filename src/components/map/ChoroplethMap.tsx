import { useState, useCallback, useMemo } from 'react'
import ReactMap, { Source, Layer, Popup, NavigationControl } from 'react-map-gl'
import type { MapLayerMouseEvent } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { resolveCountryToIso2 } from '@/utils/countryRegions'
import type { MapSubmission } from '@/types'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

const GRAD_LIGHT   = '#1d7733'
const GRAD_DARK    = '#0e5921'
const COLOR_DRAFT  = 'rgba(245,158,11,0.75)'
const COLOR_NONE   = 'rgba(0,0,0,0)'
const SOURCE_ID    = 'iffs-countries'
const LAYER_FILL   = 'iffs-country-fills'
const LAYER_LINE   = 'iffs-country-outlines'
const SOURCE_URL   = 'mapbox://mapbox.country-boundaries-v1'
const SOURCE_LAYER = 'country_boundaries'

function lerpColor(a: string, b: string, t: number): string {
  const hex = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16)
  const r = Math.round(hex(a, 1) + (hex(b, 1) - hex(a, 1)) * t)
  const g = Math.round(hex(a, 3) + (hex(b, 3) - hex(a, 3)) * t)
  const v = Math.round(hex(a, 5) + (hex(b, 5) - hex(a, 5)) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`
}

/** Resolve a MapSubmission's country to an uppercase ISO-2 code, or '' */
function resolveIso2(row: MapSubmission): string {
  if (!row.country) return ''
  return resolveCountryToIso2(row.country) ?? ''
}

interface PopupInfo {
  longitude: number
  latitude: number
  countryName: string
  submitted: number
  inProgress: number
}

export interface ChoroplethMapProps {
  submissions: MapSubmission[]
  height?: string | number
}

export function ChoroplethMap({ submissions, height = 420 }: ChoroplethMapProps) {
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)

  // ── Derive per-country data ─────────────────────────────────────────────────
  const { fillColorExpr, maxCount, countryStats, resolvedCount, unresolvedSamples } = useMemo(() => {
    const stats = new Map<string, { submitted: number; inProgress: number }>()
    const unresolved: string[] = []

    for (const row of submissions) {
      const iso2 = resolveIso2(row)
      if (!iso2) {
        if (row.country) unresolved.push(row.country)
        continue
      }
      const key = iso2.toUpperCase()
      if (!stats.has(key)) stats.set(key, { submitted: 0, inProgress: 0 })
      const s = stats.get(key)!
      if (row.status === 'submitted' || row.status === 'reviewed') {
        s.submitted++
      } else if (row.status === 'draft') {
        s.inProgress++
      }
    }

    const resolvedCount = stats.size
    const unresolvedSamples = [...new Set(unresolved)].slice(0, 10)

    if (import.meta.env.DEV) {
      console.info(
        `[ChoroplethMap] ${resolvedCount} countries resolved from ${submissions.length} submissions` +
        (unresolved.length > 0 ? ` (${unresolved.length} unresolved)` : '')
      )
      if (unresolved.length > 0) {
        console.warn('[ChoroplethMap] Unresolved country values:', unresolvedSamples)
      }
    }

    const maxCount = resolvedCount > 0
      ? Math.max(1, ...Array.from(stats.values()).map(s => s.submitted))
      : 1

    // Build Mapbox match expression
    const expr: unknown[] = ['match', ['get', 'iso_3166_1_alpha_2']]
    stats.forEach((s, iso2Upper) => {
      const n = s.submitted
      const hasDraft = s.inProgress > 0
      const color = n > 0
        ? lerpColor(GRAD_LIGHT, GRAD_DARK, maxCount === 1 ? 0.5 : (n - 1) / (maxCount - 1))
        : hasDraft
          ? COLOR_DRAFT
          : COLOR_DRAFT
      expr.push(iso2Upper, color)
      expr.push(iso2Upper.toLowerCase(), color)
    })
    if (stats.size === 0) expr.push('__none__', COLOR_NONE)
    expr.push(COLOR_NONE) // fallback

    return { fillColorExpr: expr, maxCount, countryStats: stats, resolvedCount, unresolvedSamples }
  }, [submissions])

  // ── Hover ───────────────────────────────────────────────────────────────────
  const handleMouseEnter = useCallback((e: MapLayerMouseEvent) => {
    if (!e.features?.length) return
    const feat = e.features[0]
    const iso2Raw = feat.properties?.iso_3166_1_alpha_2 as string | undefined
    if (!iso2Raw) return
    const iso2 = iso2Raw.toUpperCase()
    const countryName = feat.properties?.name_en as string || iso2
    const s = countryStats.get(iso2) ?? { submitted: 0, inProgress: 0 }
    setPopupInfo({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      countryName,
      submitted: s.submitted,
      inProgress: s.inProgress,
    })
  }, [countryStats])

  const handleMouseLeave = useCallback(() => setPopupInfo(null), [])

  // ── Token guard ─────────────────────────────────────────────────────────────
  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
        style={{ height, background: 'var(--s2)', border: '1.5px dashed var(--bd2)' }}
      >
        <p className="font-display text-[14px] font-bold text-[#3d4a52]">
          Mapbox token not configured
        </p>
        <p className="font-body text-[12px] text-[#7a8a96] max-w-sm">
          Add <code className="bg-[#f0f4f1] px-1.5 py-0.5 rounded text-[11px]">VITE_MAPBOX_TOKEN</code> to
          your Dokploy environment variables and redeploy.
        </p>
      </div>
    )
  }

  // ── No-data diagnostic ──────────────────────────────────────────────────────
  if (submissions.length > 0 && resolvedCount === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
        style={{ height, background: 'var(--s2)', border: '1.5px dashed var(--bd2)' }}
      >
        <p className="font-display text-[14px] font-bold text-[#3d4a52]">
          Map has no data to display
        </p>
        <p className="font-body text-[12px] text-[#7a8a96] max-w-sm">
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''} found but no country values
          could be resolved.
          {unresolvedSamples.length > 0 && (
            <> Unresolved values: <em>{unresolvedSamples.join(', ')}</em></>
          )}
        </p>
        {import.meta.env.DEV && (
          <p className="font-body text-[10px] text-[#b0bec5]">
            Check console for details. Verify country values in{' '}
            <code>profiles.country</code> match ISO-2 codes or recognised names.
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative', border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
      <ReactMap
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: 20, latitude: 15, zoom: 1.6 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        interactiveLayerIds={[LAYER_FILL]}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cursor={popupInfo ? 'pointer' : 'default'}
      >
        <Source id={SOURCE_ID} type="vector" url={SOURCE_URL}>
          <Layer
            id={LAYER_FILL}
            type="fill"
            source-layer={SOURCE_LAYER}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paint={{ 'fill-color': fillColorExpr as any, 'fill-opacity': 0.82 }}
          />
          <Layer
            id={LAYER_LINE}
            type="line"
            source-layer={SOURCE_LAYER}
            paint={{
              'line-color': 'rgba(255,255,255,0.35)',
              'line-width': 0.5,
            }}
          />
        </Source>

        <NavigationControl position="top-right" showCompass={false} />

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            closeButton={false}
            anchor="bottom"
            offset={8}
          >
            <CountryPopup
              countryName={popupInfo.countryName}
              submitted={popupInfo.submitted}
              inProgress={popupInfo.inProgress}
            />
          </Popup>
        )}
      </ReactMap>

      <Legend maxCount={maxCount} />
    </div>
  )
}

// ── Country popup ───────────────────────────────────────────────────────────────

function CountryPopup({
  countryName,
  submitted,
  inProgress,
}: {
  countryName: string
  submitted: number
  inProgress: number
}) {
  const total = submitted + inProgress
  return (
    <div style={{ fontFamily: 'var(--font-body)', minWidth: 160, maxWidth: 220 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
        color: '#0d1117', marginBottom: 6, paddingBottom: 6,
        borderBottom: '1px solid #e2ebe4',
      }}>
        {countryName}
      </div>
      {total === 0 ? (
        <div style={{ fontSize: 12, color: '#b0bec5' }}>No submissions yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {submitted > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: '#1d7733' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0d1117' }}>
                {submitted} submitted
              </span>
            </div>
          )}
          {inProgress > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: '#f59e0b' }} />
              <span style={{ fontSize: 11, color: '#b07800' }}>
                {inProgress} in progress
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Legend ──────────────────────────────────────────────────────────────────────

function Legend({ maxCount }: { maxCount: number }) {
  const steps = maxCount <= 1 ? 1 : Math.min(maxCount, 5)
  const stops = Array.from({ length: steps }, (_, i) =>
    lerpColor(GRAD_LIGHT, GRAD_DARK, steps === 1 ? 0.5 : i / (steps - 1))
  )
  return (
    <div
      className="absolute bottom-4 left-4 rounded-xl px-3 py-2.5"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--bd)',
        pointerEvents: 'none',
        minWidth: 140,
      }}
    >
      <div
        className="uppercase mb-2"
        style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#7a8a96' }}
      >
        Submissions
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#7a8a96', width: 8 }}>1</span>
        <div style={{ flex: 1, height: 10, borderRadius: 4, background: `linear-gradient(to right, ${GRAD_LIGHT}, ${GRAD_DARK})` }} />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#7a8a96', width: 20 }}>
          {maxCount > 1 ? maxCount : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {stops.map((color, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { color: COLOR_DRAFT, label: 'In Progress' },
          { color: '#d4d8d0', label: 'No Response' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#5a7263' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
