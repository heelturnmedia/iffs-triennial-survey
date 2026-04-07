# Homepage Improvements — Design Spec
**Date:** 2026-04-08  
**Status:** Approved  
**File:** `src/pages/HomePage.tsx`

---

## Overview

Two sets of improvements to the IFFS 2026 Triennial Survey homepage:

1. **Features section** — add icon tiles to the three feature cards and fix a content error
2. **Hero section** — three refinements: secondary CTA, gradient separator, deadline badge

No new pages, routes, or data dependencies. All changes are self-contained within `HomePage.tsx`.

---

## 1. Features Section — Icon Cards

### 1.1 Text fix (card 03)

Change the description of the "One Submission" feature card:

| | Text |
|---|---|
| **Before** | Each country submits once, ensuring data integrity across the global dataset. |
| **After** | Each user submits once, ensuring data integrity across the global dataset. |

### 1.2 Icon tiles

Add a rounded icon tile to every `FeatureCard` in `FEATURE_CARDS`. The tile sits above the existing `number` watermark as the first child of the card.

**Tile spec:**
- Size: 44 × 44 px
- Border-radius: 12px
- Background: `#e8f5ec`
- Icon: Lucide component, `size={22}`, `color="#1d7733"`, `strokeWidth={2}` (Lucide hard-codes `strokeLinecap="round"` and `strokeLinejoin="round"` by default — do not pass these as props)
- No hover change on the tile itself

**Icon assignments:**

| Card | Lucide component | Import |
|---|---|---|
| 01 Secure & Private | `Shield` | `import { Shield } from 'lucide-react'` |
| 02 Auto-Save | `FileText` | `import { FileText } from 'lucide-react'` |
| 03 One Submission | `CheckCircle2` | `import { CheckCircle2 } from 'lucide-react'` |

Use `CheckCircle2` (not the deprecated `CheckCircle`) — matches the convention already established in `OverviewPanel.tsx`.

### 1.3 Data model change

Add an `icon` field to the `FeatureCard` interface and `FEATURE_CARDS` constant so each card carries its Lucide component reference:

```ts
interface FeatureCard {
  number: string
  title: string
  description: string
  icon: React.ElementType   // Lucide icon component
}
```

Update `FEATURE_CARDS` to include the icon:

```ts
const FEATURE_CARDS: FeatureCard[] = [
  { number: '01', title: 'Secure & Private',  icon: Shield,       description: '...' },
  { number: '02', title: 'Auto-Save',          icon: FileText,     description: '...' },
  { number: '03', title: 'One Submission',     icon: CheckCircle2, description: 'Each user submits once, ensuring data integrity across the global dataset.' },
]
```

### 1.4 Rendering

Insert the icon tile as the **first child** of the card `<div>`, before the number watermark. The tile's `marginBottom: '16px'` stacks cleanly above the number watermark's existing `mb-5` (20px) — total top-of-card breathing room is intentional and consistent with the design.

```tsx
{/* Icon tile — first child, before number watermark */}
<div
  style={{
    width: '44px', height: '44px',
    background: '#e8f5ec', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '16px',
  }}
>
  <card.icon size={22} color="#1d7733" strokeWidth={2} />
</div>

{/* Number watermark — unchanged */}
<div className="font-display font-light mb-5 leading-none" style={{ fontSize: '40px', color: 'rgba(29,119,51,0.18)' }}>
  {card.number}
</div>
{/* ... rest of card unchanged ... */}
```

---

## 2. Hero Section — Three Refinements

### 2.1 Secondary "Learn More ↓" CTA

Add a ghost outline button as a sibling to the existing primary CTA button, inside the same `flex` row wrapper.

**Behaviour:**
- Scrolls smoothly to the features section on click
- Only rendered when `!isLoggedIn` — logged-in users go to the dashboard; the scroll is irrelevant to them
- Add `id="features"` to the features `<section>` element as the scroll target. The updated opening tag:

```tsx
<section
  id="features"
  className="py-24 px-6"
  style={{ backgroundColor: '#ffffff' }}
  aria-label="Features"
>
```

**Button JSX** (sibling of the primary CTA `<button>` inside the existing `flex flex-wrap gap-4` wrapper):

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

### 2.2 Gradient separator

A `<div>` placed **between** the closing `</section>` of the hero and the opening `<section id="features">` of the features block — a direct sibling of both sections, inside the page root `<div>`.

```tsx
{/* ── Hero → Features separator ──────────────────────────────────────── */}
<div
  aria-hidden="true"
  style={{
    height: '4px',
    background: 'linear-gradient(to right, #1d7733, #2a9444, #1d7733)',
  }}
/>
```

### 2.3 Deadline badge

A pill badge placed as a **sibling `<div>` immediately after the closing `</div>` of the CTA row wrapper** (the `animate-fade-slide-up` div containing the buttons) — not inside it. This avoids nesting an animated element inside another animated parent.

Import `CalendarDays` from `lucide-react`. Use `color` prop, not `stroke`.

```tsx
{/* Deadline badge — sibling of CTA row, not inside it */}
<div
  className="animate-fade-slide-up flex items-center gap-2 mt-2"
  style={{ opacity: 0, animationDelay: '0.42s' }}
>
  <div
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
    style={{ backgroundColor: 'rgba(232,245,236,0.8)', border: '1px solid rgba(29,119,51,0.2)' }}
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

---

## Lucide imports summary

Add to the existing import block at the top of `HomePage.tsx`:

```ts
import { Shield, FileText, CheckCircle2, CalendarDays } from 'lucide-react'
```

---

## Affected Files

| File | Change |
|---|---|
| `src/pages/HomePage.tsx` | All changes — icon tiles, text fix, Learn More button, separator, deadline badge |

No other files require changes.

---

## Out of Scope

- No changes to any other page
- No changes to routing, auth, or data layer
- No changes to the hero's visual identity (colours, typography, layout)
- No new components — all changes inline in `HomePage.tsx`
