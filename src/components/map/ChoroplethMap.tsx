import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import ReactMap, { Source, Layer, Popup, NavigationControl } from 'react-map-gl'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { resolveCountryToIso2 } from '@/utils/countryRegions'
import { formatSavedAt } from '@/utils/formatDate'
import type { SubmissionRow } from '@/types'

declare const window: Window & { __env?: Record<string, string> }
const MAPBOX_TOKEN = (
  (typeof window !== 'undefined' && window.__env?.VITE_MAPBOX_TOKEN) ||
  import.meta.env.VITE_MAPBOX_TOKEN
) as string | undefined

// Submission-count gradient: light → dark green
const GRAD_LIGHT  = '#1d7733'
const GRAD_DARK   = '#0e5921'
const COLOR_DRAFT = 'rgba(245,158,11,0.75)'
const COLOR_NONE  = 'rgba(0,0,0,0)'        // transparent — show base map

/** Linearly interpolate between two hex colors. t ∈ [0, 1]. */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const r  = Math.round(ar + (br - ar) * t)
  const g  = Math.round(ag + (bg - ag) * t)
  const bv = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`
}

/** Resolve a row's country to an ISO2 code, handling all storage formats. */
function rowIso2(row: SubmissionRow): string {
  // 1. Profile country field (plain string name or ISO2)
  const profileCountry = row.country ?? row.profile?.country
  if (profileCountry) {
    const iso2 = resolveCountryToIso2(profileCountry)
    if (iso2) return iso2
  }
  // 2. Survey answer — may be a plain string, ISO2, or SurveyJS choice object
  return resolveCountryToIso2(row.data?.['Country'])
}

interface PopupInfo {
  longitude:   number
  latitude:    number
  iso2:        string
  countryName: string
  rows:        SubmissionRow[]
}

export interface ChoroplethMapProps {
  submissions: SubmissionRow[]
  height?:     string | number
}

export function ChoroplethMap({ submissions, height = 420 }: ChoroplethMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [popupInfo, setPopupInfo]   = useState<PopupInfo | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [localToken, setLocalToken] = useState<string>(() =>
    MAPBOX_TOKEN || localStorage.getItem('iffs_mapbox_token') || ''
  )
  const [mapLoaded, setMapLoaded] = useState(false)

  // ── Derived data ──────────────────────────────────────────────────────
  const { iso2Groups, submittedCounts, maxCount } = useMemo(() => {
    const groups = new Map<string, SubmissionRow[]>()
    for (const row of submissions) {
      const iso2 = rowIso2(row)
      if (!iso2) continue
      if (!groups.has(iso2)) groups.set(iso2, [])
      groups.get(iso2)!.push(row)
    }

    const counts = new Map<string, number>()
    groups.forEach((rows, iso2) => {
      counts.set(iso2, rows.filter(r => r.status === 'submitted' || r.status === 'reviewed').length)
    })

    const max = groups.size > 0
      ? Math.max(1, ...Array.from(counts.values()))
      : 1

    return { iso2Groups: groups, submittedCounts: counts, maxCount: max }
  }, [submissions])

  // ── Build fill-color match expression ─────────────────────────────────
  // Mapbox 'match' requires at least 4 elements: [op, input, val, out, fallback]
  // Always push both UPPER and lower case iso2 codes to handle any tileset casing.
  const fillColorExpr = useMemo(() => {
    const expr: unknown[] = ['match', ['get', 'iso_3166_1_alpha_2']]

    iso2Groups.forEach((_rows, iso2) => {
      const n = submittedCounts.get(iso2) ?? 0
      const color = n > 0
        ? lerpColor(GRAD_LIGHT, GRAD_DARK, maxCount === 1 ? 0.5 : (n - 1) / (maxCount - 1))
        : COLOR_DRAFT
      expr.push(iso2, color)                   // 'IN'
      expr.push(iso2.toLowerCase(), color)      // 'in'  — guard against lowercase tileset
    })

    // Guarantee ≥4 elements so Mapbox doesn't reject the expression
    if (iso2Groups.size === 0) expr.push('__none__', COLOR_NONE)

    expr.push(COLOR_NONE) // fallback: transparent → show base map colour
    return expr
  }, [iso2Groups, submittedCounts, maxCount])

  // ── Imperatively push paint update whenever expression or load changes ─
  // This bypasses any react-map-gl Layer diff quirks and guarantees the map
  // shows the latest data after it finishes loading.
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current?.getMap()
    if (!map) return
    // Wait until the layer exists (source may still be loading)
    const apply = () => {
      if (map.getLayer('country-fills')) {
        map.setPaintProperty('country-fills', 'fill-color', fillColorExpr)
      }
    }
    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('idle', apply)
    }
  }, [fillColorExpr, mapLoaded])

  // ── Token gate ────────────────────────────────────────────────────────
  if (!localToken) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed"
        style={{ height, background: 'var(--s2)', borderColor: 'var(--bd2)' }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--f3)' }}>
          🗺 Configure Mapbox Token to view choropleth map
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="pk.eyJ1..."
            style={{
              width: 320,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1.5px solid var(--bd2)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => { localStorage.setItem('iffs_mapbox_token', tokenInput); setLocalToken(tokenInput) }}
            className="rounded-lg text-white text-sm font-medium"
            style={{ padding: '8px 16px', background: 'var(--g1)', fontFamily: 'var(--font-display)', cursor: 'pointer', border: 'none' }}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  // ── Layer definitions ─────────────────────────────────────────────────
  const fillLayer = {
    id: 'country-fills',
    type: 'fill' as const,
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'fill-color': fillColorExpr as any,
      'fill-opacity': 0.82,
    },
  }

  const outlineLayer = {
    id: 'country-outlines',
    type: 'line' as const,
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'line-color': 'rgba(255,255,255,0.35)',
      'line-width': 0.5,
    },
  }

  // ── Map interaction ───────────────────────────────────────────────────
  const handleMouseEnter = useCallback((e: MapLayerMouseEvent) => {
    if (!e.features?.length) return
    const feat        = e.features[0]
    const iso2Raw     = feat.properties?.iso_3166_1_alpha_2 as string | undefined
    if (!iso2Raw) return
    const iso2        = iso2Raw.toUpperCase()
    const countryName = feat.properties?.name_en as string || iso2
    const rows        = iso2Groups.get(iso2) ?? []
    setPopupInfo({ longitude: e.lngLat.lng, latitude: e.lngLat.lat, iso2, countryName, rows })
  }, [iso2Groups])

  const handleMouseLeave = useCallback(() => setPopupInfo(null), [])

  return (
    <div
      style={{
        height,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid var(--bd)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <ReactMap
        ref={mapRef}
        mapboxAccessToken={localToken}
        initialViewState={{ longitude: 0, latitude: 20, zoom: 1.5 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        interactiveLayerIds={['country-fills']}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onLoad={() => setMapLoaded(true)}
        cursor={popupInfo ? 'pointer' : 'default'}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source id="countries" type="vector" url="mapbox://mapbox.country-boundaries-v1">
          <Layer {...fillLayer} />
          <Layer {...outlineLayer} />
        </Source>

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
              rows={popupInfo.rows}
            />
          </Popup>
        )}
      </ReactMap>

      {/* Legend */}
      <Legend maxCount={maxCount} />
    </div>
  )
}

// ── Country popup ─────────────────────────────────────────────────────────────

function CountryPopup({ countryName, rows }: { countryName: string; rows: SubmissionRow[] }) {
  const submitted  = rows.filter(r => r.status === 'submitted' || r.status === 'reviewed')
  const inProgress = rows.filter(r => r.status === 'draft' && (r.page_no ?? 0) > 0)
  const total      = rows.length

  return (
    <div style={{ fontFamily: 'var(--font-body)', minWidth: 180, maxWidth: 240 }}>
      {/* Country name */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: '#0d1117',
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: '1px solid #e2ebe4',
        }}
      >
        {countryName}
      </div>

      {total === 0 ? (
        <div style={{ fontSize: 12, color: '#b0bec5' }}>No submissions yet</div>
      ) : (
        <>
          {/* Submission count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div
              style={{
                width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                background: submitted.length > 0 ? '#1d7733' : '#f59e0b',
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0d1117' }}>
              {submitted.length} submission{submitted.length !== 1 ? 's' : ''}
            </span>
          </div>

          {inProgress.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: '#f59e0b' }} />
              <span style={{ fontSize: 11, color: '#b07800' }}>
                {inProgress.length} in progress
              </span>
            </div>
          )}

          {/* Submitter names */}
          {submitted.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {submitted.slice(0, 5).map((row, i) => {
                const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || '—'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: '#7a8a96', flexShrink: 0 }}>
                      {row.submitted_at ? formatSavedAt(row.submitted_at) : ''}
                    </span>
                    <span style={{ fontSize: 11, color: '#3d4a52' }}>{name}</span>
                  </div>
                )
              })}
              {submitted.length > 5 && (
                <div style={{ fontSize: 10, color: '#b0bec5', marginTop: 2 }}>
                  +{submitted.length - 5} more
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ maxCount }: { maxCount: number }) {
  const steps = maxCount <= 1 ? 1 : Math.min(maxCount, 5)
  const gradientStops = Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0.5 : i / (steps - 1)
    return lerpColor(GRAD_LIGHT, GRAD_DARK, t)
  })

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

      {/* Gradient bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#7a8a96', width: 8, textAlign: 'right' }}>1</span>
        <div
          style={{
            flex: 1,
            height: 10,
            borderRadius: 4,
            background: `linear-gradient(to right, ${GRAD_LIGHT}, ${GRAD_DARK})`,
          }}
        />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#7a8a96', width: 20 }}>
          {maxCount > 1 ? maxCount : ''}
        </span>
      </div>

      {/* Color steps */}
      <div style={{ display: 'flex', gap: 3 }}>
        {gradientStops.map((color, i) => (
          <div
            key={i}
            style={{ width: 12, height: 12, borderRadius: 2, background: color }}
            title={`${Math.round(1 + (i / Math.max(steps - 1, 1)) * (maxCount - 1))} submission(s)`}
          />
        ))}
      </div>

      {/* Draft / no response */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { color: COLOR_DRAFT, label: 'In Progress' },
          { color: '#d4d8d0',   label: 'No Response' },
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
