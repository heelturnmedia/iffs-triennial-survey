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

Add a rounded icon tile to every `FeatureCard` in `FEATURE_CARDS`. The tile sits above the existing `number` watermark.

**Tile spec:**
- Size: 44 × 44 px
- Border-radius: 12px
- Background: `#e8f5ec`
- Icon: Lucide SVG, 22 × 22 px, stroke `#1d7733`, stroke-width 2, linecap/linejoin round
- No hover change on the tile itself

**Icon assignments:**

| Card | Icon (Lucide name) | SVG path summary |
|---|---|---|
| 01 Secure & Private | `Shield` | `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>` |
| 02 Auto-Save | `FileText` | File with lines |
| 03 One Submission | `CheckCircle` | Circle with checkmark |

**Implementation note:** Lucide icons are already used elsewhere in the codebase (`lucide-react` is in `package.json`). Import `Shield`, `FileText`, and `CheckCircle` from `lucide-react` rather than inlining raw SVG.

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

### 1.4 Rendering

In the card render, insert the icon tile **before** the number watermark:

```tsx
<div
  style={{
    width: '44px', height: '44px',
    background: '#e8f5ec', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '16px',
  }}
>
  <card.icon size={22} stroke="#1d7733" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
</div>
```

---

## 2. Hero Section — Three Refinements

### 2.1 Secondary "Learn More ↓" CTA

Add a ghost outline button to the right of the existing "Take the Survey / Go to Dashboard" button.

**Behaviour:**
- Scrolls smoothly to the features section on click (`document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })`)
- Only rendered when the user is **not** logged in (`!isLoggedIn`) — logged-in users go straight to the dashboard, a "Learn More" scroll is irrelevant to them
- Add `id="features"` to the features `<section>` element as the scroll target

**Style:**
```tsx
<button
  type="button"
  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
  className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none"
  style={{ border: '1.5px solid rgba(29,119,51,0.45)', color: '#1d7733', backgroundColor: 'transparent' }}
  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(29,119,51,0.06)' }}
  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
>
  Learn More <span aria-hidden="true">↓</span>
</button>
```

### 2.2 Gradient separator

A `<div>` placed between the closing `</section>` of the hero and the opening `<section>` of the features block.

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

A pill badge placed in the CTA row, below the buttons, rendered for all visitors (logged in and not).

```tsx
{/* Deadline badge */}
<div
  className="animate-fade-slide-up flex items-center gap-2 mt-2"
  style={{ opacity: 0, animationDelay: '0.42s' }}
>
  <div
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
    style={{ backgroundColor: 'rgba(232,245,236,0.8)', border: '1px solid rgba(29,119,51,0.2)' }}
  >
    <CalendarDays size={13} stroke="#0e5921" strokeWidth={2} />
    <span
      className="font-display text-[11px] font-semibold tracking-[0.06em]"
      style={{ color: '#0e5921' }}
    >
      Submissions close 31 March 2027
    </span>
  </div>
</div>
```

Import `CalendarDays` from `lucide-react`.

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
