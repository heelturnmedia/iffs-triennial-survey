# Import JSON Survey Definition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder survey definition with the official IFFS 2026 Triennial Survey JSON — stored in Supabase (primary) and bundled in the frontend (fallback).

**Architecture:** Copy the canonical JSON into `src/data/`, rewrite `survey-definition.ts` to re-export it (dropping 1,573 lines of hand-crafted TypeScript), then seed the JSON into the live Supabase `survey_definitions` table via a Node.js migration runner. The modal's existing fallback (`activeDefinition?.definition ?? SURVEY_DEFINITION`) picks up both paths automatically.

**Tech Stack:** Node.js (`pg` driver — must be installed, see Task 5), TypeScript/Vite (tsc for type verification), PostgreSQL/Supabase

---

## Chunk 1: Frontend — copy JSON + rewrite TypeScript

### Task 1: Copy the canonical JSON into the project

**Files:**
- Create: `src/data/survey-definition.json` (copy of source file)

- [ ] **Step 1.1: Copy the JSON file**

> On Windows, use the PowerShell form (primary). The bash backslash continuation can fail silently if trailing spaces are present.

PowerShell (primary):
```powershell
Copy-Item "D:\IFFS\2026\February\json survey\iffs-triennial-survey-2026-FINAL.json" `
          "D:\live projects\iffs-triennial-survey-2026\src\data\survey-definition.json"
```

bash (alternative):
```bash
cp "D:/IFFS/2026/February/json survey/iffs-triennial-survey-2026-FINAL.json" "D:/live projects/iffs-triennial-survey-2026/src/data/survey-definition.json"
```

- [ ] **Step 1.2: Verify the copy**

```bash
node --input-type=module << 'EOF'
import { readFileSync } from 'fs'
const j = JSON.parse(readFileSync('D:/live projects/iffs-triennial-survey-2026/src/data/survey-definition.json', 'utf8'))
console.log('Pages:', j.pages.length)       // Expected: 20
let total = 0
j.pages.forEach(p => total += (p.elements || []).length)
console.log('Elements:', total)             // Expected: 525
console.log('Has title:', !!j.title)        // Expected: true
EOF
```

Expected output:
```
Pages: 20
Elements: 525
Has title: true
```

---

### Task 2: Rewrite `src/data/survey-definition.ts`

**Files:**
- Modify: `src/data/survey-definition.ts` (replace entire file — currently 1,573 lines)

**Why:** The existing file is a hand-crafted TypeScript mirror that can drift. The new version imports the canonical JSON directly and derives `SURVEY_PAGES_META` from it. Only `SURVEY_DEFINITION` and `SURVEY_PAGES_META` are imported elsewhere — the `SurveyModel` interface, `SurveyPage` interface, and individual `page1`–`page20` exports are unused and will be dropped.

- [ ] **Step 2.1: Confirm which exports are consumed**

Run (to verify nothing imports `page1`–`page20` or `SurveyModel`):
```bash
grep -rn "from '@/data/survey-definition'\|from '../data/survey-definition'" \
  "D:/live projects/iffs-triennial-survey-2026/src/" --include="*.tsx" --include="*.ts"
```

Expected: exactly three imports, all from known files:
- `src/components/survey/SurveyModal.tsx` — imports `{ SURVEY_DEFINITION }`
- `src/components/survey/SurveySectionHeader.tsx` — imports `{ SURVEY_PAGES_META }`
- `src/components/survey/SurveyTimeline.tsx` — imports `{ SURVEY_PAGES_META }`

> If any file imports `page1`–`page20` or `SurveyModel`, stop and note it before proceeding.

- [ ] **Step 2.2: Write the new `survey-definition.ts`**

Replace the entire contents of `src/data/survey-definition.ts` with:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// IFFS 2026 Triennial Survey — canonical definition
// Source: iffs-triennial-survey-2026-FINAL.json (20 pages, 525 questions)
//
// SURVEY_DEFINITION  → used by SurveyModal as the SurveyJS model fallback
// SURVEY_PAGES_META  → used by SurveyTimeline + SurveySectionHeader for sidebar
// ─────────────────────────────────────────────────────────────────────────────
import surveyDefJson from './survey-definition.json'
import type { SurveyPageMeta } from '@/types'

type SurveyPage = { title?: string; name: string; description?: string }
type SurveyJson  = { pages: SurveyPage[] }

// Primary export — the full SurveyJS definition object
export const SURVEY_DEFINITION = surveyDefJson

// Sidebar metadata — derived from the JSON so they can never drift out of sync.
// All 20 pages have a `title` field. Pages 13 and 17 have no `description`
// (handled by the '' fallback).
export const SURVEY_PAGES_META: SurveyPageMeta[] = (
  surveyDefJson as unknown as SurveyJson
).pages.map((p) => ({
  name:        p.title ?? p.name,
  description: p.description ?? '',
}))
```

> **TypeScript flag note:** `tsconfig.app.json` sets `"noUncheckedSideEffectImports": true` and `"noUnusedLocals": true`. The `as unknown as SurveyJson` cast is the correct pattern (avoids `as any`). Both local type aliases (`SurveyPage`, `SurveyJson`) are used in the cast expression and will not be flagged by `noUnusedLocals`. If `tsc` rejects the `.json` import with an error about the extension, create `src/data/survey-definition.json.d.ts` containing:
> ```typescript
> declare const value: unknown
> export default value
> ```
> Then add that file to the commit in Step 3.2. (This is only needed if tsc errors — Vite's `moduleResolution: bundler` typically handles it without a declaration file.)

---

### Task 3: Verify TypeScript compiles cleanly

**Files:** possibly create `src/data/survey-definition.json.d.ts` (only if tsc errors)

- [ ] **Step 3.1: Run TypeScript type check**

```bash
cd "D:/live projects/iffs-triennial-survey-2026"
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
```

Expected: no output (exit code 0).

If you see an error about the `.json` import (e.g. `cannot find module` or a side-effect import error), create `src/data/survey-definition.json.d.ts`:
```typescript
declare const value: unknown
export default value
```
Then re-run tsc. It should pass cleanly.

> `noUnusedLocals: true` is active. If tsc flags `SurveyPage` or `SurveyJson` as unused, add `// @ts-expect-error -- used in type cast` above the cast, or inline the types: `(surveyDefJson as unknown as { pages: { title?: string; name: string; description?: string }[] })`. In practice, types used in cast expressions are considered used by recent TypeScript versions.

- [ ] **Step 3.2: Commit frontend changes**

```bash
cd "D:/live projects/iffs-triennial-survey-2026"
# Include the .d.ts file only if it was created in Step 3.1
git add src/data/survey-definition.json src/data/survey-definition.ts
# git add src/data/survey-definition.json.d.ts  # uncomment if created
git commit -m "feat: replace hand-crafted survey TS with canonical JSON import

Import official iffs-triennial-survey-2026-FINAL.json (20 pages, 525 questions)
into src/data/. Rewrite survey-definition.ts to re-export it and derive
SURVEY_PAGES_META dynamically so sidebar labels can never drift from the form.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: Database migration

### Task 4: Create the SQL migration file

**Files:**
- Create: `supabase/migrations/006_seed_survey_definition.sql`

This file is the version-controlled record of what the runner does. It uses a `$1` placeholder — the runner passes the JSON as a parameter, which avoids embedding 358 KB in a SQL file and eliminates quoting issues.

> **Note:** This SQL file is NOT independently runnable via `psql` or the Supabase SQL editor because of the `$1` parameter. It must be executed through the Node.js runner in Task 5. This is intentional — embedding 358 KB of JSON inline in SQL creates quoting risks.

- [ ] **Step 4.1: Create the SQL migration file**

Create `supabase/migrations/006_seed_survey_definition.sql` with this content:

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Seed official IFFS 2026 Triennial Survey definition
-- ─────────────────────────────────────────────────────────────────────────────
-- Seeds the canonical survey JSON into the pre-existing active definition row.
-- The JSON is passed as parameter $1 by the Node.js runner (run-migration-006.mjs)
-- to avoid embedding 358 KB inline and to sidestep SQL quoting issues.
--
-- NOT independently runnable via psql — requires the Node.js runner in Task 5.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.survey_definitions
SET
  name        = 'IFFS 2026 Triennial Survey',
  description = '20-section survey on ART policies and practices across 147 countries. 525 questions.',
  definition  = $1::jsonb,
  is_active   = true
  -- updated_at is handled automatically by the survey_definitions_updated_at trigger
WHERE id = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 4.2: Commit the SQL file**

```bash
cd "D:/live projects/iffs-triennial-survey-2026"
git add supabase/migrations/006_seed_survey_definition.sql
git commit -m "feat: add migration 006 — seed canonical survey definition

SQL template for seeding the official IFFS 2026 JSON into the active
survey_definitions row. JSON passed as parameter by the Node.js runner.
is_active explicitly set to true to guarantee the row loads on app boot.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Write and run the migration runner

**Files:**
- Create (temp): `run-migration-006.mjs` — deleted after successful run

> **Prerequisites:**
> 1. `pg` package — may or may not be installed (see Step 5.1). Do not skip this step.
> 2. DB password — check `.env` for the Supabase project URL (ref: `njvvktgtnadvooxhqhwf`). Ask the user for the DB password if needed.

- [ ] **Step 5.1: Install `pg` if not present (required — do not skip)**

```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
try { require('pg'); console.log('pg: available') }
catch { console.log('pg: NOT found') }
EOF
```

If output is `pg: NOT found`, install it:
```bash
cd "D:/live projects/iffs-triennial-survey-2026"
npm install --save-dev pg
```

(`--save-dev` is correct — `pg` is a migration tool, not a runtime frontend dependency.)

- [ ] **Step 5.2: Create the runner script**

Create `run-migration-006.mjs` in the project root:

```javascript
// run-migration-006.mjs
// Temporary script — delete after successful run
import { readFileSync }  from 'fs'
import { createRequire } from 'module'

const require  = createRequire(import.meta.url)
const { Client } = require('pg')

// ── Config ───────────────────────────────────────────────────────────────────
// Set DB_PASSWORD env var before running:
//   $env:DB_PASSWORD="your-password"   (PowerShell)
//   export DB_PASSWORD="your-password" (bash)
const DB_PASSWORD = process.env.DB_PASSWORD
if (!DB_PASSWORD) {
  console.error('ERROR: set DB_PASSWORD environment variable first')
  process.exit(1)
}

const CONNECTION = {
  host:     'db.njvvktgtnadvooxhqhwf.supabase.co',
  port:     5432,
  database: 'postgres',
  user:     'postgres',
  password: DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
}

// ── Load files ────────────────────────────────────────────────────────────────
const SQL        = readFileSync('./supabase/migrations/006_seed_survey_definition.sql', 'utf8')
const surveyJson = JSON.parse(
  readFileSync('./src/data/survey-definition.json', 'utf8')
)

// ── Run ───────────────────────────────────────────────────────────────────────
const client = new Client(CONNECTION)
await client.connect()
console.log('Connected to Supabase.')

const result = await client.query(SQL, [JSON.stringify(surveyJson)])
console.log(`Rows updated: ${result.rowCount}`)  // Expected: 1

if (result.rowCount !== 1) {
  console.error('ERROR: expected 1 row updated, got', result.rowCount)
  console.error('The seeded row may not exist. See fallback INSERT in the plan (Task 5, Step 5.3).')
  await client.end()
  process.exit(1)
}

// Verify
const check = await client.query(
  `SELECT name, description, is_active,
          jsonb_array_length(definition->'pages') AS page_count
   FROM public.survey_definitions
   WHERE id = '00000000-0000-0000-0000-000000000001'`
)
const row = check.rows[0]
console.log('Verification:', row)
// Expected: { name: 'IFFS 2026 Triennial Survey', is_active: true, page_count: 20 }

if (row.page_count !== 20) {
  console.error('ERROR: expected 20 pages, got', row.page_count)
  process.exit(1)
}
if (row.is_active !== true) {
  console.error('ERROR: is_active is not true — the definition will not load')
  process.exit(1)
}

await client.end()
console.log('Done. Survey definition is live.')
```

- [ ] **Step 5.3: Set the DB password and run**

PowerShell:
```powershell
$env:DB_PASSWORD="<your-db-password>"
cd "D:\live projects\iffs-triennial-survey-2026"
node run-migration-006.mjs
```

Bash:
```bash
DB_PASSWORD="<your-db-password>" node run-migration-006.mjs
```

Expected output:
```
Connected to Supabase.
Rows updated: 1
Verification: { name: 'IFFS 2026 Triennial Survey', description: '...', is_active: true, page_count: 20 }
Done. Survey definition is live.
```

**If `Rows updated: 0` (row does not exist):** Replace the SQL query in the runner with this UPSERT — pass the same `surveyJson` parameter as `$1`. This must still be run via the Node.js runner (not pasted into psql) because of the `$1` parameter:

```sql
INSERT INTO public.survey_definitions
  (id, name, description, definition, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'IFFS 2026 Triennial Survey',
  '20-section survey on ART policies and practices across 147 countries. 525 questions.',
  $1::jsonb,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      definition  = EXCLUDED.definition,
      is_active   = true;
  -- updated_at handled by trigger
```

Replace the `client.query(SQL, ...)` call in the runner with `client.query(UPSERT_SQL, [JSON.stringify(surveyJson)])` where `UPSERT_SQL` is the string above.

- [ ] **Step 5.4: Delete the runner script**

PowerShell:
```powershell
Remove-Item "D:\live projects\iffs-triennial-survey-2026\run-migration-006.mjs"
```

bash:
```bash
rm "D:/live projects/iffs-triennial-survey-2026/run-migration-006.mjs"
```

---

## Chunk 3: Final verification

### Task 6: Build check + smoke test

**Files:** none

- [ ] **Step 6.1: Run production build**

```bash
cd "D:/live projects/iffs-triennial-survey-2026"
node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build
```

Expected: build completes with no errors.

> **Bundle size note:** Vite may warn that a chunk exceeds 500 KB. The survey JSON (~358 KB) lands in whatever chunk imports `survey-definition.ts` — this warning is expected and acceptable since the JSON is only the fallback (Supabase is the primary path). To silence it, add `build: { chunkSizeWarningLimit: 600 }` to `vite.config.ts`, but this is not required for the task.

- [ ] **Step 6.2: Start dev server and smoke-test the survey**

```bash
node node_modules/vite/bin/vite.js
```

Then in browser at `http://localhost:5173`:

1. ☐ Sign in with any account (admin or regular user)
2. ☐ Click "Take Survey" / open the survey modal
3. ☐ **SurveyTimeline** (left sidebar) shows exactly 20 sections — first is "Participant's Information", last is "ART - Anonymity"
4. ☐ **SurveySectionHeader** shows the correct page title and description for the current page (Page 1: "Participant's Information")
5. ☐ Page 1 renders the Participant's Information form (country, name, email, etc.)
6. ☐ Navigate to page 2 — "ART Infrastructure" loads correctly
7. ☐ Open browser DevTools → Network tab: confirm a request to Supabase `survey_definitions` returns the row with `is_active: true` in the response
8. ☐ In the Admin "Survey Management" panel: the definition shows as "IFFS 2026 Triennial Survey" with its description visible **and its status shown as active**
9. ☐ **Fallback test:** In DevTools → Network tab, right-click the `survey_definitions` Supabase request and select "Block request URL". Reload the page, sign in again, and open the survey modal. Confirm the survey still renders with 20 sections and the correct Timeline (loading from the bundled JSON fallback). Then unblock the URL and reload.

- [ ] **Step 6.3: Final commit**

```bash
cd "D:/live projects/iffs-triennial-survey-2026"
git status  # should be clean after all prior commits
```

If clean, no commit needed. If any files remain uncommitted:

```bash
git add -A
git commit -m "chore: post-migration cleanup

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Reference: Key Files

| File | Role |
|------|------|
| `src/data/survey-definition.json` | Canonical survey JSON (source of truth) |
| `src/data/survey-definition.ts` | Re-exports JSON + derives `SURVEY_PAGES_META` |
| `src/data/survey-definition.json.d.ts` | TypeScript ambient declaration (only if needed) |
| `supabase/migrations/006_seed_survey_definition.sql` | SQL UPDATE template (parameterized, run via Node.js) |
| `src/components/survey/SurveyModal.tsx:10,45` | Imports `SURVEY_DEFINITION`; uses it as fallback |
| `src/components/survey/SurveyTimeline.tsx:73` | Consumes `SURVEY_PAGES_META` |
| `src/components/survey/SurveySectionHeader.tsx:23` | Consumes `SURVEY_PAGES_META` |
| `src/services/surveyService.ts:127` | `getActiveDefinition()` — fetches from Supabase |

## Reference: DB Row

```
Table:  public.survey_definitions
ID:     00000000-0000-0000-0000-000000000001
Column: definition (JSONB) — the full SurveyJS JSON object
Column: is_active  (bool)  — must be true; explicitly set by migration 006
```

## Reference: tsconfig.app.json Flags That Affect This Work

| Flag | Value | Impact |
|------|-------|--------|
| `moduleResolution` | `bundler` | Enables JSON imports without `resolveJsonModule` |
| `noUncheckedSideEffectImports` | `true` | May require `survey-definition.json.d.ts` — see Step 3.1 |
| `noUnusedLocals` | `true` | Local type aliases used only in cast expressions are considered "used" in recent TS |
