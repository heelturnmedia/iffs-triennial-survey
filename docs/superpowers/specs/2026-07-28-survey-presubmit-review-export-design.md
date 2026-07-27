# Pre-submission review + Download/Print — Design

**Date:** 2026-07-28
**Status:** Approved (design), pending spec review
**Branch:** `feature/survey-presubmit-review`

## Motivation

A survey respondent asked for a way to see all their answers on one page before final
submission — to review as a whole, print it, and share with local experts for a final
check. Because the survey is one-submission-per-country and locked after submit, a
last-confirmation step has real value.

## Goal

1. An on-screen **summary of all responses** before final submission, with the ability
   to jump back and edit.
2. A **Download PDF** and a **Print** button available in the survey, producing the
   existing IFFS-branded, question-by-question response PDF.
3. A **"DRAFT — not yet submitted"** marker on the PDF while the response is not yet
   submitted, so a shared review copy is never mistaken for the official record.

## Scope

**In:** Frontend-only changes to the survey modal and the individual-PDF builder.
**Out:** No DB/server/RLS changes. No new dependencies. No respondent-facing CSV
(admins keep that). The SurveyJS 2.3.6 → 2.5.35 upgrade is a **separate** PR, not part
of this work. This feature is fully supported on the current 2.3.6.

## Design

### 1. On-screen review step (native SurveyJS)

Add `showPreviewBeforeComplete: 'showAllQuestions'` to the `Model` config in
`src/components/survey/SurveyModal.tsx`.

- On the last page, SurveyJS shows a **Preview** button. It renders a read-only summary
  of every answer grouped by section/page, each with an inline **Edit** control.
- The preview's final button (relabeled **"Submit Survey"** via `completeText`) fires the
  **existing** `onCompleting` handler → the existing confirm dialog → `submitSurvey()`.
  **No change to submission logic** — the review simply slots in front of it.
- The timeline sidebar and sticky section header remain. Preview renders in the same
  content area with the same SurveyJS CSS, so styling is consistent.

### 2. Toolbar buttons — Download PDF + Print (always available)

Two compact buttons in the modal top bar (next to Save & Close), enabled once at least
one answer exists (`Object.keys(surveyModel.data).length > 0`).

Both build a lightweight `SubmissionRow`-shaped object from live state:

```
{
  id:           submission?.id ?? '',
  user_id:      user.id,
  status:       submission?.status ?? 'draft',
  reference_no: submission?.reference_no ?? '',
  page_no:      surveyModel.currentPageNo,
  data:         surveyModel.data,
  submitted_at: submission?.submitted_at ?? null,
  first_name:   profile?.first_name, last_name: profile?.last_name,
  email:        profile?.email, institution: profile?.institution,
  country:      profile?.country,          // buildIndividualMeta also falls back to data['Country']
}
```

- Reuse the existing pipeline with `definitionPages` (from
  `activeDefinition?.definition ?? SURVEY_DEFINITION`) and `SECTION_NAMES` (`@/constants`).
- **Download** → `exportIndividualPdf(row, pages, names)` → saves
  `iffs-survey-response-<name|ref>.pdf`.
- **Print** → `buildIndividualPdfDoc(row, pages, names)`, then `doc.autoPrint()` and open
  `doc.output('bloburl')` in a new tab → browser print dialog on the branded PDF.
  Triggered by the direct button click (user gesture) so it isn't popup-blocked.
- `jspdf` / the exporter are **lazy-imported on click** (mirrors `ReportsPanel`), keeping
  the survey bundle lean.

### 3. "DRAFT — not yet submitted" stamp

In `buildIndividualPdfDoc` (`src/utils/exportIndividualPdf.ts`), when
`row.status !== 'submitted' && row.status !== 'reviewed'`, render a small **muted-red**
(e.g. RGB `[176, 58, 46]`) "DRAFT — not yet submitted" line directly under the
"Individual Survey Response" subtitle, so it reads as a warning. Submitted rows (the
admin export path) are unchanged — no stamp. This keeps a single PDF code path shared
between the respondent and admin.

## Files touched

- `src/components/survey/SurveyModal.tsx` — enable preview + `completeText`; add the two
  toolbar buttons and their click handlers (build row, lazy-import exporter).
- `src/utils/exportIndividualPdf.ts` — conditional DRAFT stamp.
- (If the row-building logic is non-trivial, extract a tiny `buildDraftRow(...)` helper
  next to the modal; otherwise inline it.)

## Edge cases

- **No answers yet** → buttons disabled (no empty PDF).
- **Country/meta** → `buildIndividualMeta` already falls back to `data['Country']` and
  profile fields; reference/submitted_at blank for drafts is expected.
- **Question types** → `formatAnswerText` already handles boolean/checkbox/tagbox/
  radiogroup/dropdown/matrix/matrixdropdown/multipletext.
- **Popup blocker (Print)** → mitigated by initiating `window.open` from the click.
- **Terminal status** → if already submitted, buttons still work (produce a no-DRAFT PDF);
  preview/submit path is unaffected because SurveyJS won't re-open a completed model.

## Verification

- `tsc -b` and `eslint` clean.
- Dev server (`/dashboard` → open survey): fill a few answers across sections, then
  - confirm the **Preview** step lists all answers grouped by section with Edit + a
    "Submit Survey" button;
  - **Download PDF** yields a file containing those answers and the **DRAFT** stamp;
  - **Print** opens the print dialog on the branded PDF;
  - buttons are disabled before any answer is entered.
