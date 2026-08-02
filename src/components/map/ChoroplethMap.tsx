import { useState, useCallback, useMemo, useRef } from 'react'
import ReactMap, { Source, Layer, Popup, NavigationControl } from 'react-map-gl'
import type { MapLayerMouseEvent, MapEvent } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { resolveCountryToIso2 } from '@/utils/countryRegions'
import {
  GREEN_LIGHT, GREEN_DARK, AMBER_LIGHT, AMBER_DARK,
  NO_RESPONSE_FILL, NO_RESPONSE_SWATCH,
  shadeByCount, applyWaterTheme,
} from './mapTheme'
import type { MapSubmission } from '@/types'

declare const window: Window & { __env?: Record<string, string> }
// window.__env is written at container start by docker-entrypoint.sh (runtime injection).
// import.meta.env is baked in at build time. In Dokploy, runtime env vars win.
const MAPBOX_TOKEN = (
  (typeof window !== 'undefined' && window.__env?.VITE_MAPBOX_TOKEN) ||
  import.meta.env.VITE_MAPBOX_TOKEN ||
  ''
) as string

const COLOR_NONE   = NO_RESPONSE_FILL
const SOURCE_ID    = 'iffs-countries'
const LAYER_FILL   = 'iffs-country-fills'
const LAYER_LINE   = 'iffs-country-outlines'
const SOURCE_URL   = 'mapbox://mapbox.country-boundaries-v1'
const SOURCE_LAYER = 'country_boundaries'

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
  const { fillColorExpr, countryStats, resolvedCount, unresolvedSamples } = useMemo(() => {
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

    // Always log — admin-only panel, useful for production diagnostics
    console.info(
      `[ChoroplethMap] ${resolvedCount} countries resolved from ${submissions.length} submissions` +
      (unresolved.length > 0 ? ` (${unresolved.length} unresolved)` : '')
    )
    if (unresolved.length > 0) {
      console.warn('[ChoroplethMap] Unresolved country values:', unresolvedSamples)
    }

    // Graduate each country by volume: the busiest submitted country takes the
    // full brand green, the quietest the light tint, and likewise for amber on
    // in-progress. Colours are resolved here in JS rather than as a data-driven
    // Mapbox expression because the counts already live on the client.
    let maxSubmitted = 0
    let maxInProgress = 0
    stats.forEach((s) => {
      if (s.submitted > maxSubmitted) maxSubmitted = s.submitted
      if (s.inProgress > maxInProgress) maxInProgress = s.inProgress
    })

    // Build Mapbox match expression
    // The mapbox.country-boundaries-v1 tileset uses 'iso_3166_1' (alpha-2),
    // NOT 'iso_3166_1_alpha_2' — that property does not exist in the tileset.
    const expr: unknown[] = ['match', ['get', 'iso_3166_1']]
    stats.forEach((s, iso2Upper) => {
      // Submitted wins over in-progress: a country that has delivered reads as
      // delivered. Anything with neither falls through to the no-response fill
      // (previously it was painted amber, which mislabelled it on the legend).
      const color = s.submitted > 0
        ? shadeByCount(s.submitted, maxSubmitted, GREEN_LIGHT, GREEN_DARK)
        : s.inProgress > 0
          ? shadeByCount(s.inProgress, maxInProgress, AMBER_LIGHT, AMBER_DARK)
          : COLOR_NONE
      expr.push(iso2Upper, color)
      expr.push(iso2Upper.toLowerCase(), color)
    })
    if (stats.size === 0) expr.push('__none__', COLOR_NONE)
    expr.push(COLOR_NONE) // fallback

    return { fillColorExpr: expr, countryStats: stats, resolvedCount, unresolvedSamples }
  }, [submissions])

  // ── Hover ───────────────────────────────────────────────────────────────────
  // onMouseMove, not onMouseEnter. Every country is drawn by the same fill
  // layer, so entering one and sweeping to its neighbour never leaves the
  // layer — mouseenter fires once and the popup then stays on the first
  // country until the cursor exits to open water and comes back. mousemove
  // gives the feature under the cursor on every frame.
  const hoveredIsoRef = useRef<string | null>(null)

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0]
    const iso2Raw = feat?.properties?.iso_3166_1 as string | undefined
    if (!iso2Raw) {
      // Over the map but not over a country (ocean) — drop the popup.
      if (hoveredIsoRef.current !== null) {
        hoveredIsoRef.current = null
        setPopupInfo(null)
      }
      return
    }
    const iso2 = iso2Raw.toUpperCase()
    const countryName = (feat?.properties?.name_en as string) || iso2
    const s = countryStats.get(iso2) ?? { submitted: 0, inProgress: 0 }
    hoveredIsoRef.current = iso2
    // Anchor the popup to the country under the cursor. Re-using the previous
    // object when nothing changed lets React bail out of the re-render, so
    // sweeping within one country doesn't re-render on every mousemove.
    setPopupInfo((prev) =>
      prev &&
      prev.countryName === countryName &&
      prev.submitted === s.submitted &&
      prev.inProgress === s.inProgress
        ? prev
        : {
            longitude: e.lngLat.lng,
            latitude: e.lngLat.lat,
            countryName,
            submitted: s.submitted,
            inProgress: s.inProgress,
          },
    )
  }, [countryStats])

  const handleMouseLeave = useCallback(() => {
    hoveredIsoRef.current = null
    setPopupInfo(null)
  }, [])

  const handleLoad = useCallback((e: MapEvent) => {
    applyWaterTheme(e.target)
  }, [])

  // Memoised so react-map-gl doesn't diff a freshly-built paint object — and
  // re-issue setPaintProperty for a match expression covering every country —
  // on each of the many re-renders a mousemove hover produces.
  const fillPaint = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => ({ 'fill-color': fillColorExpr as any, 'fill-opacity': 0.82 }),
    [fillColorExpr],
  )
  const linePaint = useMemo(
    () => ({ 'line-color': 'rgba(255,255,255,0.35)', 'line-width': 0.5 }),
    [],
  )

  // ── Token guard ─────────────────────────────────────────────────────────────
  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
        style={{ height, background: 'var(--s2)', border: '1.5px dashed var(--bd2)' }}
      >
        <p className="font-display text-[14px] font-bold text-f2">
          Mapbox token not configured
        </p>
        <p className="font-body text-[12px] text-f3 max-w-sm">
          Add <code className="bg-s2 px-1.5 py-0.5 rounded-sm text-[11px]">VITE_MAPBOX_TOKEN</code> to
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
        <p className="font-display text-[14px] font-bold text-f2">
          Map has no data to display
        </p>
        <p className="font-body text-[12px] text-f3 max-w-sm">
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''} found but no country values
          could be resolved.
          {unresolvedSamples.length > 0 && (
            <> Unresolved values: <em>{unresolvedSamples.join(', ')}</em></>
          )}
        </p>
        <p className="font-body text-[10px] text-f4">
          Check browser console for details. Verify country values in{' '}
          <code>survey_submissions.data[&apos;Country&apos;]</code> match ISO-2 codes or recognised names.
        </p>
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
        onLoad={handleLoad}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        cursor={popupInfo ? 'pointer' : 'default'}
      >
        <Source id={SOURCE_ID} type="vector" url={SOURCE_URL}>
          <Layer
            id={LAYER_FILL}
            type="fill"
            source-layer={SOURCE_LAYER}
            paint={fillPaint}
          />
          <Layer
            id={LAYER_LINE}
            type="line"
            source-layer={SOURCE_LAYER}
            paint={linePaint}
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

      <Legend />
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
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: GREEN_DARK }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0d1117' }}>
                {submitted} submitted
              </span>
            </div>
          )}
          {inProgress > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: AMBER_DARK }} />
              <span style={{ fontSize: 11, color: '#8a7405' }}>
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

function Legend() {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { swatch: `linear-gradient(90deg, ${GREEN_LIGHT}, ${GREEN_DARK})`, label: 'Submitted' },
          { swatch: `linear-gradient(90deg, ${AMBER_LIGHT}, ${AMBER_DARK})`, label: 'In Progress' },
          { swatch: NO_RESPONSE_SWATCH, label: 'No Response' },
        ].map(({ swatch, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 26, height: 10, borderRadius: 2, background: swatch, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#5a7263' }}>{label}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 4,
          fontFamily: 'var(--font-body)', fontSize: 9, color: '#b0bec5',
        }}
      >
        <span>Fewer</span>
        <span>More</span>
      </div>
    </div>
  )
}
