# Homepage Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add icon tiles to the three feature cards, fix a content error on card 03, and add three hero refinements (secondary CTA, gradient separator, deadline badge) to `src/pages/HomePage.tsx`.

**Architecture:** All changes are self-contained in a single file (`src/pages/HomePage.tsx`). The `FeatureCard` interface gains an `icon` field typed as `React.ElementType`, four Lucide icons are imported, and new JSX is added to the hero CTA row and between sections. No new files, no new components, no routing or data changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, inline styles, `lucide-react`

---

## Chunk 1: All tasks

### Task 1: Add Lucide imports

**Files:**
- Modify: `src/pages/HomePage.tsx` (top of file, import block)

- [ ] **Step 1: Open `src/pages/HomePage.tsx` and locate the existing import block.**

The file currently has these imports at the top:
```ts
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'
```

- [ ] **Step 2: Add Lucide icon imports immediately after the existing imports.**

```ts
import { Shield, FileText, CheckCircle2, CalendarDays } from 'lucide-react'
```

- [ ] **Step 3: Start the Vite dev server if not already running.**

```bash
npm run dev
```

Open `http://localhost:5173`. Confirm the page loads without console errors (the import alone changes nothing visible yet).

- [ ] **Step 4: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): import Lucide icons for homepage improvements"
```

---

### Task 2: Update `FeatureCard` interface and `FEATURE_CARDS` constant

**Files:**
- Modify: `src/pages/HomePage.tsx` (Types and Constants sections, lines ~10–49)

- [ ] **Step 1: Update the `FeatureCard` interface to add the `icon` field.**

Replace:
```ts
interface FeatureCard {
  number: string
  title: string
  description: string
}
```
With:
```ts
interface FeatureCard {
  number: string
  title: string
  description: string
  icon: React.ElementType
}
```

- [ ] **Step 2: Update `FEATURE_CARDS` to add icons and fix the card 03 text.**

Replace the entire `FEATURE_CARDS` constant:
```ts
const FEATURE_CARDS: FeatureCard[] = [
  {
    number: '01',
    title: 'Secure & Private',
    icon: Shield,
    description:
      'Your responses are encrypted and only visible to IFFS administrators.',
  },
  {
    number: '02',
    title: 'Auto-Save',
    icon: FileText,
    description:
      'Progress saves automatically after every answer — complete at your own pace.',
  },
  {
    number: '03',
    title: 'One Submission',
    icon: CheckCircle2,
    description:
      'Each user submits once, ensuring data integrity across the global dataset.',
  },
]
```

- [ ] **Step 3: Verify TypeScript compiles cleanly.**

The dev server terminal should show no TypeScript errors after saving. If it shows a red error about `icon` being used but not defined in the render (we haven't updated the render yet), that is expected and will be fixed in Task 3.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): add icon field to FeatureCard, fix card 03 text to 'Each user submits once'"
```

---

### Task 3: Render icon tile in each feature card

**Files:**
- Modify: `src/pages/HomePage.tsx` (card render block, inside `FEATURE_CARDS.map(...)`)

- [ ] **Step 1: Locate the card render block.**

Find the `{FEATURE_CARDS.map((card) => (` block (around line 319). The current first child inside the card `<div>` is the number watermark:
```tsx
<div
  className="font-display font-light mb-5 leading-none"
  style={{ fontSize: '40px', color: 'rgba(29,119,51,0.18)' }}
>
  {card.number}
</div>
```

- [ ] **Step 2: Insert the icon tile as the first child of the card, before the number watermark.**

```tsx
{/* Icon tile */}
<div
  style={{
    width: '44px',
    height: '44px',
    background: '#e8f5ec',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  }}
>
  <card.icon size={22} color="#1d7733" strokeWidth={2} />
</div>
```

The card order after this change will be:
1. Icon tile (new)
2. Number watermark (unchanged)
3. Green divider bar (unchanged)
4. `h3` title (unchanged)
5. `p` description (unchanged)

- [ ] **Step 3: Visually verify in the browser.**

Navigate to `http://localhost:5173`. The "Built for Global Medical Research" section should show:
- A small rounded green icon tile at the top of each card (shield / document / checkmark)
- Card 03 description now reads "Each user submits once, ensuring data integrity across the global dataset."
- All three cards hover correctly (lift + glow)

- [ ] **Step 4: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): add icon tiles to feature cards (Shield, FileText, CheckCircle2)"
```

---

### Task 4: Add `id="features"` to the features section and "Learn More ↓" button to the hero

**Files:**
- Modify: `src/pages/HomePage.tsx` (features `<section>` opening tag + hero CTA row)

- [ ] **Step 1: Add `id="features"` to the features section opening tag.**

Find the features section opening tag (around line 292):
```tsx
<section
  className="py-24 px-6"
  style={{ backgroundColor: '#ffffff' }}
  aria-label="Features"
>
```

Replace with:
```tsx
<section
  id="features"
  className="py-24 px-6"
  style={{ backgroundColor: '#ffffff' }}
  aria-label="Features"
>
```

- [ ] **Step 2: Add the "Learn More ↓" button inside the hero CTA row.**

Find the CTA row `<div>` (around line 159) — the `animate-fade-slide-up flex flex-wrap gap-4` wrapper that contains the primary "Take the Survey" button. Add the ghost button as a sibling of the primary button, inside the same wrapper, after the closing `</button>` of the primary CTA:

```tsx
{!isLoggedIn && (
  <button
    type="button"
    aria-label="Learn more about the survey features"
    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
    className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none"
    style={{ border: '1.5px solid rgba(29,119,51,0.45)', color: '#1d7733', backgroundColor: 'transparent' }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(29,119,51,0.06)' }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
  >
    Learn More <span aria-hidden="true">↓</span>
  </button>
)}
```

- [ ] **Step 3: Visually verify in the browser (logged-out state).**

At `http://localhost:5173` (not logged in):
- The hero CTA row shows two buttons side by side: "Take the Survey →" (green filled) and "Learn More ↓" (green outline)
- Clicking "Learn More ↓" smoothly scrolls the page down to the features section
- Hovering the ghost button shows a very light green tint

- [ ] **Step 4: Verify the button is hidden when logged in.**

Log into the app. On the homepage, confirm only the "Go to Dashboard" button is shown — no "Learn More ↓" button.

- [ ] **Step 5: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): add 'Learn More' scroll CTA to hero, add id to features section"
```

---

### Task 5: Add gradient separator between hero and features

**Files:**
- Modify: `src/pages/HomePage.tsx` (between hero `</section>` and features `<section>`)

- [ ] **Step 1: Locate the gap between the hero and features sections.**

Find the closing `</section>` of the hero (the one containing the left-copy panel and dark-green right panel), followed immediately by the features `<section id="features">`. It looks like:

```tsx
      </div>
    </section>

    {/* ── FEATURES ... */}
    <section
      id="features"
```

- [ ] **Step 2: Insert the gradient separator `<div>` between the two sections.**

```tsx
      </div>
    </section>

    {/* ── Hero → Features separator ──────────────────────────────────────── */}
    <div
      aria-hidden="true"
      style={{
        height: '4px',
        background: 'linear-gradient(to right, #1d7733, #2a9444, #1d7733)',
      }}
    />

    {/* ── FEATURES ... */}
    <section
      id="features"
```

- [ ] **Step 3: Visually verify in the browser.**

Scroll to the boundary between the hero and the features section. A 4px gradient strip (dark green → bright green → dark green, left to right) should visually separate the dark-green hero panel from the white features section.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): add green gradient separator between hero and features sections"
```

---

### Task 6: Add deadline badge below CTA row

**Files:**
- Modify: `src/pages/HomePage.tsx` (hero left-panel content column, after CTA row wrapper)

- [ ] **Step 1: Locate the closing `</div>` of the CTA row wrapper.**

In the hero left panel content column (`<div className="relative z-10 max-w-xl">`), find the CTA row `<div>` — the one with `className="animate-fade-slide-up flex flex-wrap gap-4"` and `animationDelay: '0.32s'`. It closes with `</div>` after the buttons.

- [ ] **Step 2: Add the deadline badge as a sibling immediately after the CTA row's closing `</div>`.**

Do NOT place this inside the CTA row wrapper — it must be a sibling, not a child:

```tsx
            </div>{/* ← closing </div> of CTA row wrapper */}

            {/* Deadline badge */}
            <div
              className="animate-fade-slide-up flex items-center gap-2 mt-2"
              style={{ opacity: 0, animationDelay: '0.42s' }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: 'rgba(232,245,236,0.8)',
                  border: '1px solid rgba(29,119,51,0.2)',
                }}
              >
                <CalendarDays size={13} color="#0e5921" strokeWidth={2} />
                <span
                  className="font-display text-[11px] font-semibold tracking-[0.06em]"
                  style={{ color: '#0e5921' }}
                >
                  Submissions close 31 March 2027
                </span>
              </div>
            </div>
```

- [ ] **Step 3: Visually verify in the browser.**

At `http://localhost:5173`:
- Below the CTA buttons, a small green-tinted pill reads "Submissions close 31 March 2027" with a calendar icon to its left
- The pill fades in slightly after the buttons (animation delay 0.42s vs 0.32s on the buttons)
- The badge is visible for both logged-in and logged-out states

- [ ] **Step 4: Check for console errors.**

Open DevTools → Console. There should be zero errors or warnings related to this change.

- [ ] **Step 5: Final visual review — scroll through the full homepage.**

Check the full page top to bottom:
- [ ] Hero: animated badge, h1, description, two CTA buttons (logged-out) or one (logged-in), deadline pill
- [ ] Gradient separator: 4px green strip visible between hero and features
- [ ] Features section header: unchanged
- [ ] Card 01: Shield icon tile → "01" watermark → bar → "Secure & Private"
- [ ] Card 02: FileText icon tile → "02" watermark → bar → "Auto-Save"
- [ ] Card 03: CheckCircle2 icon tile → "03" watermark → bar → "One Submission" — description reads "Each **user** submits once…"
- [ ] All three cards lift and glow correctly on hover
- [ ] Footer: unchanged

- [ ] **Step 6: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): add submission deadline badge to hero CTA row"
```

---

### Task 7: Push branch

- [ ] **Step 1: Push the branch.**

```bash
git push origin claude/intelligent-leavitt
```

No PR needed — this branch already has an open PR from earlier work. The new commits will appear on it automatically.
