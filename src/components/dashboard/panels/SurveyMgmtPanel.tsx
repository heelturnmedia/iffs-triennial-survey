// ─────────────────────────────────────────────────────────────────────────────
// Survey Management Panel
// Uses SurveyJS Creator v2 per https://surveyjs.io/survey-creator/documentation
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import {
  getSurveyDefinitions,
  getActiveDefinition,
  saveSurveyDefinition,
  setActiveDefinition,
} from '@/services/surveyService'
import { formatDateTime } from '@/utils/formatDate'
import type { SurveyDefinition } from '@/types'

// ── SurveyJS CSS — must be static imports so Vite injects them at load time ──
import 'survey-core/defaultV2.min.css'
import 'survey-creator-core/survey-creator-core.min.css'

// ── SurveyJS modules ─────────────────────────────────────────────────────────
import { SurveyCreatorModel } from 'survey-creator-core'
import { SurveyCreator } from 'survey-creator-react'
import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'

type Tab = 'library' | 'creator' | 'preview'

// ─── Library tab ──────────────────────────────────────────────────────────────

interface LibraryTabProps {
  definitions: SurveyDefinition[]
  loading: boolean
  onSetActive: (id: string) => void
  onPreview: (def: SurveyDefinition) => void
  onEdit: (def: SurveyDefinition) => void
  settingActiveId: string | null
}

function LibraryTab({
  definitions,
  loading,
  onSetActive,
  onPreview,
  onEdit,
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
      <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid var(--bd)' }}>
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
              onClick={() => onEdit(def)}
              className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] border-[#c8d9cc] text-[#3d4a52] hover:border-[#1d7733] hover:text-[#1d7733] hover:bg-[#e8f5ec] transition-all"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onPreview(def)}
              className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] border-[#c8d9cc] text-[#3d4a52] hover:border-[#1d7733] hover:text-[#1d7733] hover:bg-[#e8f5ec] transition-all"
            >
              Preview
            </button>
            {!def.is_active && (
              <button
                type="button"
                onClick={() => onSetActive(def.id)}
                disabled={settingActiveId === def.id}
                className="inline-flex items-center gap-1.5 font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-60"
                style={{ background: 'var(--g1)' }}
                onMouseEnter={(e) => {
                  if (settingActiveId !== def.id)
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
                }}
              >
                {settingActiveId === def.id && (
                  <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                )}
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
// Per SurveyJS docs: https://surveyjs.io/survey-creator/documentation/get-started-react

interface CreatorTabProps {
  editingDefinition: SurveyDefinition | null
  onSave: (json: Record<string, unknown>, name: string) => Promise<void>
}

function CreatorTab({ editingDefinition, onSave }: CreatorTabProps) {
  // Keep onSave stable via ref to avoid recreating the creator
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // Create model once; update JSON when the editing definition changes
  const [creator] = useState(() => {
    const model = new SurveyCreatorModel({
      showLogicTab: true,
      isAutoSave: false,
      haveCommercialLicense: true,
    })

    model.saveSurveyFunc = (saveNo: number, callback: (no: number, ok: boolean) => void) => {
      const name = editingDefinition?.name ?? ('Survey ' + new Date().toLocaleDateString())
      onSaveRef.current(model.JSON as Record<string, unknown>, name)
        .then(() => callback(saveNo, true))
        .catch(() => callback(saveNo, false))
    }

    return model
  })

  // Load definition JSON whenever the editing target changes
  useEffect(() => {
    creator.JSON = editingDefinition?.definition ?? {}
  }, [creator, editingDefinition])

  return (
    <div style={{ height: '82vh' }}>
      <SurveyCreator model={creator} />
    </div>
  )
}

// ─── Preview tab ──────────────────────────────────────────────────────────────
// Per SurveyJS docs: https://surveyjs.io/form-library/documentation/get-started-react

interface PreviewTabProps {
  definition: SurveyDefinition | null
  previewOverride?: SurveyDefinition | null
}

function PreviewTab({ definition, previewOverride }: PreviewTabProps) {
  const def = previewOverride ?? definition

  if (!def) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid var(--bd)' }}>
        <p className="font-body text-[14px] text-[#b0bec5]">
          No active survey definition to preview.
        </p>
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
      <SurveyPreview key={def.id} definition={def} />
    </div>
  )
}

function SurveyPreview({ definition }: { definition: SurveyDefinition }) {
  const [model] = useState(() => {
    const m = new Model(definition.definition)
    m.mode = 'display'
    return m
  })

  return <Survey model={model} />
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
  const [editingDefinition, setEditingDefinition] = useState<SurveyDefinition | null>(null)

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

  useEffect(() => { void fetchAll() }, [fetchAll])

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

  // ── Preview from library ──────────────────────────────────────────────────
  const handlePreview = (def: SurveyDefinition) => {
    setPreviewDef(def)
    setTab('preview')
  }

  // ── Edit in creator ───────────────────────────────────────────────────────
  const handleEdit = (def: SurveyDefinition) => {
    setEditingDefinition(def)
    setTab('creator')
  }

  // ── Save from creator ─────────────────────────────────────────────────────
  const handleSave = useCallback(async (json: Record<string, unknown>, name: string) => {
    await saveSurveyDefinition(name, json, user?.id)
    toast(`Saved "${name}".`, 'ok')
    await fetchAll()
  }, [user?.id, toast, fetchAll])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'creator', label: 'Creator' },
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
              if (t.id !== 'preview') setPreviewDef(null)
              if (t.id !== 'creator') setEditingDefinition(null)
              setTab(t.id)
            }}
            className="font-display text-[11px] font-bold tracking-[0.10em] uppercase px-4 py-2 rounded-lg transition-all"
            style={{
              background: tab === t.id ? '#ffffff' : 'transparent',
              color: tab === t.id ? 'var(--g1)' : 'var(--f3)',
              boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t.label}
            {t.id === 'creator' && editingDefinition && (
              <span className="ml-1.5 font-body text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#e8f5ec] text-[#0e5921]">
                editing
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <LibraryTab
          definitions={definitions}
          loading={loading}
          onSetActive={handleSetActive}
          onPreview={handlePreview}
          onEdit={handleEdit}
          settingActiveId={settingActiveId}
        />
      )}
      {tab === 'creator' && (
        <CreatorTab
          editingDefinition={editingDefinition}
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
