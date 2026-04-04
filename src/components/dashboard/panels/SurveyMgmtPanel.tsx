import React, { useState, useEffect, useCallback, useRef } from 'react'
// Fix RC-2: static CSS import so Vite bundles it correctly.
// Dynamic import of CSS inside useEffect is broken in Vite 4+ and fails silently.
import 'survey-creator-core/survey-creator-core.min.css'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import {
  getSurveyDefinitions,
  getActiveDefinition,
  saveSurveyDefinition,
  updateSurveyDefinition,
  setActiveDefinition,
} from '@/services/surveyService'
import { formatDateTime } from '@/utils/formatDate'
import type { SurveyDefinition } from '@/types'

// Survey Creator — dynamically imported to keep the main bundle lean.
let SurveyCreatorComponent: React.ComponentType<{ model: unknown }> | null = null

type Tab = 'library' | 'creator' | 'preview'

// ─── Library tab ──────────────────────────────────────────────────────────────

interface LibraryTabProps {
  definitions: SurveyDefinition[]
  loading: boolean
  onSetActive: (id: string) => void
  onEdit: (def: SurveyDefinition) => void
  onPreview: (def: SurveyDefinition) => void
  settingActiveId: string | null
}

function LibraryTab({
  definitions,
  loading,
  onSetActive,
  onEdit,
  onPreview,
  settingActiveId,
}: LibraryTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (definitions.length === 0) {
    return (
      <div
        className="bg-white rounded-2xl p-10 text-center"
        style={{ border: '1px solid var(--bd)' }}
      >
        <p className="font-body text-[14px] text-[#b0bec5]">
          No survey definitions yet. Use the Creator tab to build one.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {definitions.map((def) => (
        <div
          key={def.id}
          className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{
            border: `1px solid ${def.is_active ? 'var(--g1)' : 'var(--bd)'}`,
            boxShadow: def.is_active ? '0 0 0 1px var(--g1) inset' : 'var(--shadow-sm)',
          }}
        >
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-display text-[14px] font-bold text-[#0d1117] truncate">
                {def.name}
              </h3>
              {def.is_active && (
                <span className="inline-flex items-center gap-1 font-body text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4] tracking-[0.04em]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1d7733]" />
                  Active
                </span>
              )}
            </div>
            <p className="font-body text-[11px] text-[#7a8a96] mt-0.5">
              Created {formatDateTime(def.created_at)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => onPreview(def)}
              className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] border-[#c8d9cc] text-[#3d4a52] hover:border-[#1d7733] hover:text-[#1d7733] hover:bg-[#e8f5ec] transition-all"
            >
              Preview
            </button>
            {/* Fix RC-1: Edit button loads the definition into the Creator */}
            <button
              type="button"
              onClick={() => onEdit(def)}
              className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] border-[#c8d9cc] text-[#3d4a52] hover:border-[#7c3aed] hover:text-[#7c3aed] hover:bg-[#f5f3ff] transition-all"
            >
              Edit
            </button>
            {!def.is_active && (
              <button
                type="button"
                onClick={() => onSetActive(def.id)}
                disabled={settingActiveId === def.id}
                className="inline-flex items-center gap-1.5 font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-60"
                style={{ background: 'var(--g1)' }}
                onMouseEnter={(e) => {
                  if (settingActiveId !== def.id) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
                  }
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
                }}
              >
                {settingActiveId === def.id ? (
                  <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                ) : null}
                Set Active
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Creator tab ──────────────────────────────────────────────────────────────

interface CreatorTabProps {
  // Fix RC-3: renamed from activeDefinition — now receives whichever definition
  // was explicitly selected for editing (via Edit button) or falls back to null
  // (empty creator). The parent uses a key prop to force remount when this changes.
  definitionToEdit: SurveyDefinition | null
  onSave: (json: Record<string, unknown>) => Promise<void>
}

function CreatorTab({ definitionToEdit, onSave }: CreatorTabProps) {
  const [creatorLoaded, setCreatorLoaded] = useState(false)
  const [creatorError, setCreatorError] = useState<string | null>(null)
  const creatorRef = useRef<{
    JSON: Record<string, unknown>
    saveSurveyFunc: ((saveNo: number, cb: (no: number, ok: boolean) => void) => void) | null
  } | null>(null)

  useEffect(() => {
    Promise.all([
      import('survey-creator-core').catch(() => null),
      import('survey-creator-react').catch(() => null),
    ])
      .then(([coreModule, reactModule]) => {
        if (!coreModule || !reactModule) {
          setCreatorError(
            'survey-creator-react is not installed. Run: npm install survey-creator-react'
          )
          return
        }

        const { SurveyCreatorModel } = coreModule
        const { SurveyCreator } = reactModule

        const model = new SurveyCreatorModel({
          showLogicTab: true,
          isAutoSave: false,
          haveCommercialLicense: true,
        })

        // Fix RC-3: use definitionToEdit from props (captured correctly at mount
        // because the parent re-mounts this component via key when it changes)
        if (definitionToEdit?.definition) {
          model.JSON = definitionToEdit.definition
        }

        model.saveSurveyFunc = (saveNo: number, callback: (no: number, ok: boolean) => void) => {
          onSave(model.JSON as Record<string, unknown>)
            .then(() => callback(saveNo, true))
            .catch(() => callback(saveNo, false))
        }

        creatorRef.current = model
        SurveyCreatorComponent = SurveyCreator as unknown as React.ComponentType<{ model: unknown }>
        setCreatorLoaded(true)
      })
      .catch((err) => {
        setCreatorError(String(err))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (creatorError) {
    return (
      <div
        className="bg-white rounded-2xl p-8 text-center"
        style={{ border: '1px solid var(--bd)' }}
      >
        <p className="font-body text-[14px] text-red-600 mb-2">Survey Creator unavailable</p>
        <p className="font-body text-[12px] text-[#7a8a96]">{creatorError}</p>
      </div>
    )
  }

  if (!creatorLoaded || !SurveyCreatorComponent || !creatorRef.current) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {definitionToEdit && (
        <div
          className="mb-3 px-4 py-2 rounded-lg flex items-center gap-2"
          style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9.5 2L12 4.5L5 11.5H2.5V9L9.5 2Z" stroke="#7c3aed" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          <p className="font-body text-[12px] font-semibold text-[#5b21b6]">
            Editing: <span className="font-normal">{definitionToEdit.name}</span>
            {definitionToEdit.is_active && (
              <span className="ml-2 text-[#0e5921] bg-[#e8f5ec] border border-[#afc7b4] rounded-full px-2 py-0.5 text-[10px]">Active</span>
            )}
          </p>
        </div>
      )}
      <div style={{ height: '80vh' }}>
        <SurveyCreatorComponent model={creatorRef.current} />
      </div>
    </div>
  )
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

interface PreviewTabProps {
  definition: SurveyDefinition | null
  previewOverride?: SurveyDefinition | null
}

function PreviewTab({ definition, previewOverride }: PreviewTabProps) {
  const [surveyLoaded, setSurveyLoaded] = useState(false)
  const [surveyError, setSurveyError] = useState<string | null>(null)
  const def = previewOverride ?? definition

  useEffect(() => {
    if (!def) return

    Promise.all([
      import('survey-core').catch(() => null),
      import('survey-react-ui').catch(() => null),
    ])
      .then(([coreModule, reactModule]) => {
        if (!coreModule || !reactModule) {
          setSurveyError('survey-react-ui is not installed. Run: npm install survey-react-ui')
          return
        }
        setSurveyLoaded(true)
      })
      .catch((err) => setSurveyError(String(err)))
  }, [def])

  if (!def) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid var(--bd)' }}>
        <p className="font-body text-[14px] text-[#b0bec5]">
          No active survey definition to preview.
        </p>
      </div>
    )
  }

  if (surveyError) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid var(--bd)' }}>
        <p className="font-body text-[14px] text-red-600 mb-2">Preview unavailable</p>
        <p className="font-body text-[12px] text-[#7a8a96]">{surveyError}</p>
      </div>
    )
  }

  return (
    <div>
      <div
        className="mb-4 px-4 py-2.5 rounded-lg flex items-center gap-2"
        style={{ background: 'var(--g3)', border: '1px solid var(--bd2)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="#1d7733" strokeWidth="1.4" />
          <path d="M7 5v2.5M7 9.5v.1" stroke="#1d7733" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p className="font-body text-[12px] font-semibold text-[#0e5921]">
          This is a preview — no data will be saved.
        </p>
      </div>

      {!surveyLoaded ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
        </div>
      ) : (
        <SurveyJsPreview definition={def} />
      )}
    </div>
  )
}

// Separate component so lazy import works correctly
function SurveyJsPreview({ definition }: { definition: SurveyDefinition }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cleanup: (() => void) | null = null

    Promise.all([
      import('survey-core'),
      import('survey-react-ui'),
      import('react-dom/client'),
    ]).then(([coreModule, reactModule, domModule]) => {
      if (!containerRef.current) return

      const { Model } = coreModule
      const { Survey } = reactModule
      const { createRoot } = domModule

      const model = new Model(definition.definition)
      model.mode = 'display'

      const root = createRoot(containerRef.current)
      root.render(
        <Survey model={model} />
      )
      cleanup = () => root.unmount()
    }).catch(console.error)

    return () => cleanup?.()
  }, [definition])

  return <div ref={containerRef} />
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SurveyMgmtPanel() {
  const { user } = useAuthStore()
  const { toast } = useUIStore()

  const [tab, setTab] = useState<Tab>('library')
  const [definitions, setDefinitions] = useState<SurveyDefinition[]>([])
  const [activeDefinition, setActiveDefinitionState] = useState<SurveyDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null)
  const [previewDef, setPreviewDef] = useState<SurveyDefinition | null>(null)
  // Fix RC-1 & RC-3: track which definition is loaded in the Creator
  const [editingDef, setEditingDef] = useState<SurveyDefinition | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [defs, active] = await Promise.all([
        getSurveyDefinitions(),
        getActiveDefinition(),
      ])
      setDefinitions(defs)
      setActiveDefinitionState(active)
    } catch {
      toast('Failed to load survey definitions.', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ── Set active ────────────────────────────────────────────────────────────
  const handleSetActive = async (id: string) => {
    setSettingActiveId(id)
    try {
      await setActiveDefinition(id)
      toast('Active survey updated.', 'ok')
      await fetchAll()
    } catch {
      toast('Failed to set active survey.', 'err')
    } finally {
      setSettingActiveId(null)
    }
  }

  // Fix RC-1: load selected definition into the Creator
  const handleEditDef = (def: SurveyDefinition) => {
    setEditingDef(def)
    setTab('creator')
  }

  // ── Preview from library ──────────────────────────────────────────────────
  const handlePreview = (def: SurveyDefinition) => {
    setPreviewDef(def)
    setTab('preview')
  }

  // Fix RC-4: update existing definition if editing one, otherwise insert new
  const handleSave = async (json: Record<string, unknown>) => {
    if (editingDef?.id) {
      await updateSurveyDefinition(editingDef.id, json)
      toast(`"${editingDef.name}" updated.`, 'ok')
    } else {
      const name = 'Survey ' + new Date().toLocaleDateString()
      await saveSurveyDefinition(name, json, user?.id)
      toast(`Saved "${name}".`, 'ok')
    }
    await fetchAll()
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'creator', label: editingDef ? `Editing: ${editingDef.name}` : 'Creator' },
    { id: 'preview', label: 'Preview' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-display text-[22px] font-bold text-[#0d1117]">Survey Management</h1>
        <p className="font-body text-[13px] text-[#7a8a96] mt-0.5">
          Manage survey definitions, build new versions, and preview forms
        </p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0.5 mb-6 p-1 rounded-xl w-fit"
        style={{ background: 'var(--s2)', border: '1px solid var(--bd)' }}
        role="tablist"
        aria-label="Survey management tabs"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              if (t.id === 'library') setEditingDef(null)
              if (t.id !== 'preview') setPreviewDef(null)
              setTab(t.id)
            }}
            className="font-display text-[11px] font-bold tracking-[0.10em] uppercase px-4 py-2 rounded-lg transition-all max-w-[200px] truncate"
            style={{
              background: tab === t.id ? '#ffffff' : 'transparent',
              color: tab === t.id ? (t.id === 'creator' && editingDef ? '#7c3aed' : 'var(--g1)') : 'var(--f3)',
              boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <LibraryTab
          definitions={definitions}
          loading={loading}
          onSetActive={handleSetActive}
          onEdit={handleEditDef}
          onPreview={handlePreview}
          settingActiveId={settingActiveId}
        />
      )}
      {tab === 'creator' && (
        // Fix RC-3: key forces remount when the definition being edited changes,
        // ensuring the creator model always loads the correct JSON.
        <CreatorTab
          key={editingDef?.id ?? 'new'}
          definitionToEdit={editingDef}
          onSave={handleSave}
        />
      )}
      {tab === 'preview' && (
        <PreviewTab
          definition={activeDefinition}
          previewOverride={previewDef}
        />
      )}
    </div>
  )
}
