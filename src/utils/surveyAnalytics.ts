// ─────────────────────────────────────────────────────────────────────────────
// Survey Analytics — extract questions from a definition page and aggregate
// answers from submitted surveys.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedQuestion {
  name: string
  title: string
  type: string
  choices?: Array<{ value: string; text: string }>
  rows?: Array<{ value: string; text: string }>
  columns?: Array<{ value: string; text: string }>
  items?: Array<{ name: string; title: string }>
}

export interface AggregatedQuestion {
  question: ExtractedQuestion
  totalAnswered: number
  choiceCounts?: Record<string, number>   // radiogroup, checkbox, dropdown, boolean
  textResponses?: string[]                // text, comment
  matrixCounts?: Record<string, Record<string, number>> // matrix, matrixdropdown
  multitextAnswers?: Record<string, string[]>           // multipletext
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return String(obj['default'] ?? obj['en'] ?? Object.values(obj)[0] ?? '')
  }
  return String(val)
}

function normalizeChoice(choice: unknown): { value: string; text: string } {
  if (typeof choice === 'string') return { value: choice, text: choice }
  const c = choice as Record<string, unknown>
  const value = String(c['value'] ?? c['text'] ?? '')
  const text = normalizeText(c['text'] ?? c['value'] ?? '')
  return { value, text: text || value }
}

// ─── Extract all leaf questions from a survey page ───────────────────────────

export function extractQuestionsFromPage(page: unknown): ExtractedQuestion[] {
  const questions: ExtractedQuestion[] = []

  function processElements(elements: unknown[]): void {
    for (const el of elements) {
      const e = el as Record<string, unknown>
      const type = String(e['type'] ?? 'text')

      if (type === 'panel') {
        processElements((e['elements'] ?? []) as unknown[])
        continue
      }

      if (type === 'file') continue // skip file uploads

      const q: ExtractedQuestion = {
        name: String(e['name'] ?? ''),
        title: normalizeText(e['title'] ?? e['name'] ?? ''),
        type,
      }

      if (e['choices']) {
        q.choices = (e['choices'] as unknown[]).map(normalizeChoice)
      }
      if (e['rows']) {
        q.rows = (e['rows'] as unknown[]).map(normalizeChoice)
      }
      if (e['columns']) {
        q.columns = (e['columns'] as unknown[]).map(normalizeChoice)
      }
      if (e['items'] && Array.isArray(e['items'])) {
        q.items = (e['items'] as unknown[]).map((item) => {
          const it = item as Record<string, unknown>
          return {
            name: String(it['name'] ?? ''),
            title: normalizeText(it['title'] ?? it['name'] ?? ''),
          }
        })
      }

      if (type === 'paneldynamic') {
        // Treat as a single aggregated question, no sub-aggregation
        questions.push({ name: q.name, title: q.title, type: 'paneldynamic' })
        continue
      }

      questions.push(q)
    }
  }

  const p = page as Record<string, unknown>
  processElements((p['elements'] ?? []) as unknown[])
  return questions
}

// ─── Aggregate answers across submitted surveys ───────────────────────────────

export function aggregateSection(
  questions: ExtractedQuestion[],
  submissions: Array<{ data?: Record<string, unknown>; status?: string }>
): AggregatedQuestion[] {
  // Include all surveys that have any saved data, not just submitted ones,
  // so admins can see responses as they come in.
  const submittedData = submissions
    .filter((s) => {
      const d = s.data ?? {}
      return (s.status === 'submitted' || s.status === 'reviewed') || Object.keys(d).length > 0
    })
    .map((s) => s.data ?? {})

  return questions.map((q) => {
    const result: AggregatedQuestion = { question: q, totalAnswered: 0 }

    const answers = submittedData
      .map((d) => d[q.name])
      .filter((v) => v !== undefined && v !== null && v !== '')

    result.totalAnswered = answers.length

    switch (q.type) {
      case 'radiogroup':
      case 'dropdown':
      case 'boolean': {
        const counts: Record<string, number> = {}
        for (const ans of answers) {
          const key = String(ans)
          counts[key] = (counts[key] ?? 0) + 1
        }
        result.choiceCounts = counts
        break
      }

      case 'checkbox':
      case 'tagbox': {
        const counts: Record<string, number> = {}
        for (const ans of answers) {
          if (Array.isArray(ans)) {
            for (const item of ans as unknown[]) {
              const key = String(item)
              counts[key] = (counts[key] ?? 0) + 1
            }
          }
        }
        result.choiceCounts = counts
        break
      }

      case 'text':
      case 'comment': {
        result.textResponses = answers
          .map((a) => String(a))
          .filter(Boolean)
        break
      }

      case 'matrix':
      case 'matrixdropdown': {
        const matrixCounts: Record<string, Record<string, number>> = {}
        for (const ans of answers) {
          if (ans && typeof ans === 'object') {
            for (const [rowKey, colVal] of Object.entries(
              ans as Record<string, unknown>
            )) {
              if (!matrixCounts[rowKey]) matrixCounts[rowKey] = {}
              const key = String(colVal)
              matrixCounts[rowKey][key] = (matrixCounts[rowKey][key] ?? 0) + 1
            }
          }
        }
        result.matrixCounts = matrixCounts
        break
      }

      case 'multipletext': {
        const subAnswers: Record<string, string[]> = {}
        for (const ans of answers) {
          if (ans && typeof ans === 'object') {
            for (const [itemName, itemVal] of Object.entries(
              ans as Record<string, unknown>
            )) {
              if (!subAnswers[itemName]) subAnswers[itemName] = []
              if (itemVal !== undefined && itemVal !== null && itemVal !== '') {
                subAnswers[itemName].push(String(itemVal))
              }
            }
          }
        }
        result.multitextAnswers = subAnswers
        break
      }

      default:
        break
    }

    return result
  })
}

// ─── Sort choice counts descending ───────────────────────────────────────────

export function sortedChoiceCounts(
  counts: Record<string, number>
): Array<{ label: string; count: number }> {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}
