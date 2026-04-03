import { useRef, useState, useCallback } from 'react'
import ReactMap, { Source, Layer, Popup, NavigationControl } from 'react-map-gl'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { countryNameToIso2 } from '@/utils/countryRegions'
import { formatSavedAt } from '@/utils/formatDate'
import type { SubmissionRow } from '@/types'

declare const window: Window & { __env?: Record<string, string> }
const MAPBOX_TOKEN = (
  (typeof window !== 'undefined' && window.__env?.VITE_MAPBOX_TOKEN) ||
  import.meta.env.VITE_MAPBOX_TOKEN
) as string | undefined

// Color scale matching original design tokens
const STATUS_COLORS = {
  submitted: '#1d7733',
  draft:     '#f59e0b',
  reviewed:  '#3b82f6',
  none:      '#e2ebe4',
} as const

interface PopupInfo {
  longitude:   number
  latitude:    number
  iso2:        string
  countryName: string
  row?:        SubmissionRow
}

export interface ChoroplethMapProps {
  submissions: SubmissionRow[]
  height?:     string | number
}

export function ChoroplethMap({ submissions, height = 420 }: ChoroplethMapProps) {
  const mapRef           = useRef<MapRef>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [localToken, setLocalToken] = useState<string>(() => {
    return MAPBOX_TOKEN || localStorage.getItem('iffs_mapbox_token') || ''
  })

  // ── Token gate ────────────────────────────────────────────────────────
  if (!localToken) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed"
        style={{
          height,
          background: 'var(--s2)',
          borderColor: 'var(--bd2)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            color: 'var(--f3)',
          }}
        >
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
            onClick={() => {
              localStorage.setItem('iffs_mapbox_token', tokenInput)
              setLocalToken(tokenInput)
            }}
            className="rounded-lg text-white text-sm font-medium"
            style={{
              padding: '8px 16px',
              background: 'var(--g1)',
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  // ── Build Mapbox match expression ─────────────────────────────────────
  // ['match', ['get', 'iso_3166_1_alpha_2'], 'US', '#color', ..., fallback]
  const matchExpr: unknown[] = ['match', ['get', 'iso_3166_1_alpha_2']]
  submissions.forEach(row => {
    const country = row.country ?? row.profile?.country ?? (row.data?.['Country'] as string | undefined)
    if (!country) return
    const iso2 = countryNameToIso2(country)
    if (iso2) {
      matchExpr.push(iso2, STATUS_COLORS[row.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.none)
    }
  })
  matchExpr.push(STATUS_COLORS.none) // default fallback

  // Build iso2 → submission lookup for popup
  const iso2Map = new Map<string, SubmissionRow>()
  submissions.forEach(row => {
    const country = row.country ?? row.profile?.country ?? (row.data?.['Country'] as string | undefined)
    if (!country) return
    const iso2 = countryNameToIso2(country)
    if (iso2) iso2Map.set(iso2.toUpperCase(), row)
  })

  const fillLayer = {
    id:           'country-fills',
    type:         'fill' as const,
    source:       'countries',
    'source-layer': 'country_boundaries',
    paint: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'fill-color':   matchExpr as any,
      'fill-opacity': 0.75,
    },
  }

  const outlineLayer = {
    id:           'country-outlines',
    type:         'line' as const,
    source:       'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'line-color': 'rgba(255,255,255,0.3)',
      'line-width': 0.5,
    },
  }

  // ── Map interaction ───────────────────────────────────────────────────
  const handleMouseEnter = useCallback((e: MapLayerMouseEvent) => {
    if (!e.features?.length) return
    const feat        = e.features[0]
    const iso2        = feat.properties?.iso_3166_1_alpha_2 as string | undefined
    if (!iso2) return
    const countryName = feat.properties?.name_en as string || iso2
    const row         = iso2Map.get(iso2.toUpperCase())
    setPopupInfo({ longitude: e.lngLat.lng, latitude: e.lngLat.lat, iso2, countryName, row })
  }, [submissions]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseLeave = useCallback(() => setPopupInfo(null), [])

  // ── Map percentage helper ─────────────────────────────────────────────
  const getPct = (row: SubmissionRow): number => {
    if (row.status === 'submitted') return 100
    const pageNo = row.page_no ?? 0
    return Math.round((pageNo / 20) * 100)
  }

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
        cursor={popupInfo ? 'pointer' : 'default'}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source
          id="countries"
          type="vector"
          url="mapbox://mapbox.country-boundaries-v1"
        >
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
            <div style={{ fontFamily: 'var(--font-body)', minWidth: 160 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--f1)',
                  marginBottom: 4,
                }}
              >
                {popupInfo.countryName}
              </div>
              {popupInfo.row ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--f3)' }}>
                    {popupInfo.row.status === 'submitted'
                      ? '✅ Submitted'
                      : (popupInfo.row.page_no ?? 0) > 0
                      ? `✏️ In progress (${getPct(popupInfo.row)}%)`
                      : '⬜ Not started'}
                  </div>
                  {(popupInfo.row.first_name || popupInfo.row.last_name) && (
                    <div style={{ fontSize: 11, color: 'var(--f4)', marginTop: 2 }}>
                      {[popupInfo.row.first_name, popupInfo.row.last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                  {popupInfo.row.status === 'submitted' && popupInfo.row.submitted_at && (
                    <div style={{ fontSize: 11, color: 'var(--f4)' }}>
                      {formatSavedAt(popupInfo.row.submitted_at)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--f4)' }}>No submission yet</div>
              )}
            </div>
          </Popup>
        )}
      </ReactMap>

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-xl px-3 py-2"
        style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--bd)',
          pointerEvents: 'none',
        }}
      >
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: 'var(--f3)',
            marginBottom: 4,
          }}
        >
          Status
        </div>
        {(
          [
            { status: 'submitted', label: 'Submitted' },
            { status: 'draft',     label: 'In Progress' },
            { status: 'reviewed',  label: 'Reviewed' },
            { status: 'none',      label: 'No Response' },
          ] as const
        ).map(({ status, label }) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: STATUS_COLORS[status] }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                color: 'var(--f2)',
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
