# User Profile Panel + Password Change Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service Profile panel (visible to all users) for editing name/country/institution and changing password, and fix the currently-broken password recovery flow.

**Architecture:** New sidebar panel composed of two cards (ProfileDetailsCard, ChangePasswordCard). Password verification uses an ephemeral Supabase client to avoid side effects on the main session. Password recovery is detected via the `PASSWORD_RECOVERY` auth event (branched inside the existing `onAuthStateChange` callback) and triggers auto-navigation to the Profile panel with a guarded sidebar.

**Tech Stack:** React 18, TypeScript, Zustand, Supabase Auth, react-router-dom, lucide-react icons, existing `Toaster` / `ConfirmModal` infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-05-user-profile-password-design.md`

**Testing approach:** This codebase has no automated test harness. Verification is manual via the Claude Preview dev server — each task ends with a Preview check of the specific behavior it introduces. Do NOT introduce a test framework as part of this work.

**Branch:** `feature/auth-and-content-updates` (current worktree branch). All commits stay on this branch.

**Commit style:** Short conventional-commit subjects (e.g. `feat: add isPasswordRecovery to auth store`) with a trailer:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## File Structure

**New files** (responsibility-per-file):

| Path | Responsibility |
|---|---|
| `src/components/dashboard/panels/ProfilePanel.tsx` | Thin composition layer: reads `profile` + `isPasswordRecovery` from auth store, renders recovery banner (when applicable) plus the two cards. Owns no form state. |
| `src/components/dashboard/panels/profile/ProfileDetailsCard.tsx` | Self-contained form for `first_name`, `last_name`, `country`, `institution` + read-only `email`, `role`. Owns local form state and submit handler. |
| `src/components/dashboard/panels/profile/ChangePasswordCard.tsx` | Self-contained form for current/new/confirm password with show-hide toggles. Branches on `isPasswordRecovery` to hide "current password". Owns local form state and submit handler. |

**Modified files:**

| Path | Reason |
|---|---|
| `src/types/index.ts` | Extend `ActivePanel` union with `'profile'`. |
| `src/lib/supabase.ts` | Export `createEphemeralClient()` factory. |
| `src/services/authService.ts` | Add `updatePassword` + `verifyCurrentPassword`; delete stale `resetPasswordForEmail`. |
| `src/stores/authStore.ts` | Add `isPasswordRecovery` state + `setPasswordRecovery` action + `PASSWORD_RECOVERY` branch inside existing `onAuthStateChange`. |
| `src/components/auth/SignInForm.tsx` | Fix `redirectTo` from `/auth?mode=reset` (404) to `/dashboard`. |
| `src/components/dashboard/Sidebar.tsx` | Add Profile nav entry (all roles); gate `handleItemClick` on `isPasswordRecovery`. |
| `src/pages/DashboardPage.tsx` | Register profile panel; add recovery auto-navigation effect with ref guard; block survey modal during recovery. |

---

## Chunk 1: Foundations (types, ephemeral client, auth service, auth store)

### Task 1: Extend `ActivePanel` type union

**Files:**
- Modify: `src/types/index.ts:87-93`

- [ ] **Step 1: Read the current union.** Open `src/types/index.ts`, locate the `ActivePanel` type declaration (around lines 87-93).

- [ ] **Step 2: Add `'profile'` to the union.**

Replace:
```typescript
export type ActivePanel =
  | 'overview'
  | 'reports'
  | 'users'
  | 'survey-mgmt'
  | 'wa-settings'
  | 'app-flow'
```

With:
```typescript
export type ActivePanel =
  | 'overview'
  | 'reports'
  | 'users'
  | 'survey-mgmt'
  | 'wa-settings'
  | 'app-flow'
  | 'profile'
```

- [ ] **Step 3: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit, no errors. (The `NavItem.id` union in `Sidebar.tsx` is `ActivePanel | 'survey'` and inherits the extension automatically.)

- [ ] **Step 4: Commit.**

```bash
git add src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add profile to ActivePanel union

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `createEphemeralClient` factory

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Append the factory below the existing `supabase` export.**

Add these lines at the end of `src/lib/supabase.ts`:

```typescript

// ─── Ephemeral client factory ────────────────────────────────────────────────
// For one-shot operations that must NOT share storage with the main app,
// e.g. verifying a user's current password via signInWithPassword without
// clobbering the active session, firing SIGNED_IN on the main listener,
// or resetting the session expiry clock.
export function createEphemeralClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
```

- [ ] **Step 2: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/supabase.ts
git commit -m "$(cat <<'EOF'
feat(supabase): add createEphemeralClient factory

Ephemeral, non-persisting Supabase client for one-shot operations
that must not clobber the main session. Will be used for current-
password verification.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `updatePassword` and `verifyCurrentPassword` to auth service; delete stale `resetPasswordForEmail`

**Files:**
- Modify: `src/services/authService.ts`

- [ ] **Step 1: Update the import line.**

Replace:
```typescript
import { supabase } from '../lib/supabase'
```

With:
```typescript
import { supabase, createEphemeralClient } from '../lib/supabase'
```

- [ ] **Step 2: Delete the stale `resetPasswordForEmail` function.**

Remove the entire block (lines ~112-119):
```typescript
// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login?mode=reset`,
  })
  if (error) throw error
}
```

Rationale: this export has no callers (SignInForm calls `supabase.auth.resetPasswordForEmail` directly) and its redirect URL is inconsistent with SignInForm's. Removing prevents future confusion.

- [ ] **Step 3: Add `updatePassword` and `verifyCurrentPassword` in the same spot.**

Insert this block where `resetPasswordForEmail` used to be:

```typescript
// ─── Update Password ──────────────────────────────────────────────────────────

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ─── Verify Current Password ─────────────────────────────────────────────────
// Verifies the current password via an ephemeral Supabase client, so the main
// session is untouched (no SIGNED_IN emission, no refresh-token rotation, no
// expiry reset). Failed attempts still count against Supabase's per-email
// auth rate limiter — that's desirable (prevents brute-force).

export async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const tempClient = createEphemeralClient()
  const { error } = await tempClient.auth.signInWithPassword({ email, password })
  return !error
}
```

- [ ] **Step 4: Check for any callers of `resetPasswordForEmail` from the service module (should be zero).**

Run: `git grep -n "authService.*resetPasswordForEmail\|from '@/services/authService'.*resetPasswordForEmail"`
Expected: empty output. If there are any, stop and surface — the spec assumed no callers.

- [ ] **Step 5: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 6: Commit.**

```bash
git add src/services/authService.ts
git commit -m "$(cat <<'EOF'
feat(auth): add updatePassword and verifyCurrentPassword

verifyCurrentPassword uses an ephemeral Supabase client to avoid
side effects on the main session (no SIGNED_IN emission, no token
rotation, no expiry reset). Also removes the stale, uncalled
resetPasswordForEmail export whose redirect URL conflicted with
the active caller in SignInForm.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add `isPasswordRecovery` to auth store with `PASSWORD_RECOVERY` branch

**Files:**
- Modify: `src/stores/authStore.ts`

- [ ] **Step 1: Extend the `AuthState` interface.**

In the `AuthState` interface (around lines 17-36), add:

```typescript
  // Password recovery flag — true when a PASSWORD_RECOVERY auth event fires.
  // While true, the UI forces the user into the Profile panel and disables
  // other navigation until they set a new password.
  isPasswordRecovery: boolean
```

Add the companion action in the Actions block of the same interface:

```typescript
  setPasswordRecovery: (flag: boolean) => void
```

- [ ] **Step 2: Initialize the state field.**

In the `create<AuthState>` store body (around line 38-44), add after `error: null,`:

```typescript
  isPasswordRecovery: false,
```

- [ ] **Step 3: Add the `setPasswordRecovery` action.**

Below `setProfile`, add:

```typescript
  setPasswordRecovery: (isPasswordRecovery) => set({ isPasswordRecovery }),
```

- [ ] **Step 4: Add the `PASSWORD_RECOVERY` branch inside the existing `onAuthStateChange` callback.**

Find the existing callback body:
```typescript
async (event, session) => {
  if (event === 'SIGNED_OUT') {
    set({ session: null, user: null, loading: false, profile: null })
    return
  }
  ...
}
```

Insert this branch **after** the `SIGNED_OUT` branch and **before** the generic `set(...)` that follows:

```typescript
        if (event === 'PASSWORD_RECOVERY') {
          // Recovery sessions are for the same user — keep the cached profile
          // to preserve the "profile never null while session exists" invariant
          // (commit c9596ba). Flip the recovery flag so the UI can force
          // the user into the Profile panel.
          set((state) => ({
            session,
            user: session?.user ?? null,
            profile: state.profile,
            isPasswordRecovery: true,
            loading: false,
          }))
          return
        }
```

Critical: the `return` is load-bearing. It prevents the subsequent `SIGNED_IN`/`USER_UPDATED` re-fetch branch from racing with the recovery UX.

- [ ] **Step 5: Also ensure `SIGNED_OUT` clears the recovery flag.**

Update the existing `SIGNED_OUT` branch:
```typescript
if (event === 'SIGNED_OUT') {
  set({ session: null, user: null, loading: false, profile: null, isPasswordRecovery: false })
  return
}
```

- [ ] **Step 6: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 7: Commit.**

```bash
git add src/stores/authStore.ts
git commit -m "$(cat <<'EOF'
feat(auth-store): add isPasswordRecovery state and PASSWORD_RECOVERY branch

Branch lives inside the existing onAuthStateChange callback (single
subscription). Explicitly carries forward profile to preserve the
invariant from c9596ba. SIGNED_OUT clears the flag.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fix `SignInForm` reset redirect URL

**Files:**
- Modify: `src/components/auth/SignInForm.tsx:86`

- [ ] **Step 1: Update the redirect URL.**

In `handleForgotPassword` (around line 85-87), replace:

```typescript
await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: `${window.location.origin}/auth?mode=reset`,
})
```

With:

```typescript
await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: `${window.location.origin}/dashboard`,
})
```

Rationale: `/auth` is not a route in `App.tsx` (catches via 404). `/dashboard` lands on a valid route; the recovery session is established from the URL hash by Supabase's `detectSessionInUrl`, and `AuthGuard` passes because a session exists. The `PASSWORD_RECOVERY` event drives the UI, not a query param.

- [ ] **Step 2: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit.**

```bash
git add src/components/auth/SignInForm.tsx
git commit -m "$(cat <<'EOF'
fix(auth): point forgot-password redirect at /dashboard

/auth is not a defined route — reset links were 404ing. /dashboard
is valid, and the PASSWORD_RECOVERY auth event drives the UI so no
query param is needed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Profile UI components

### Task 6: Build `ChangePasswordCard.tsx`

**Files:**
- Create: `src/components/dashboard/panels/profile/ChangePasswordCard.tsx`

- [ ] **Step 1: Create the directory.**

Run: `mkdir -p "src/components/dashboard/panels/profile"`

- [ ] **Step 2: Create the file with the full component.**

Write `src/components/dashboard/panels/profile/ChangePasswordCard.tsx`:

```typescript
import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { updatePassword, verifyCurrentPassword } from '@/services/authService'

interface FieldErrors {
  current?: string
  next?: string
  confirm?: string
}

// Detect Supabase errors that indicate an expired / invalid recovery session.
// Supabase surfaces these as AuthApiError with status 401 or messages mentioning
// expired/invalid refresh tokens or JWT. We match permissively to catch variants.
function isRecoveryExpiredError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: number; code?: string; message?: string }
  if (e.status === 401) return true
  const msg = (e.message ?? '').toLowerCase()
  return (
    msg.includes('expired') ||
    msg.includes('invalid refresh') ||
    msg.includes('jwt') ||
    e.code === 'session_not_found'
  )
}

export function ChangePasswordCard() {
  const user = useAuthStore((s) => s.user)
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery)
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)
  const signOut = useAuthStore((s) => s.signOut)
  const toast = useUIStore((s) => s.toast)
  const [recoveryExpired, setRecoveryExpired] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {}
    if (!isPasswordRecovery && !currentPassword) {
      errs.current = 'Enter your current password'
    }
    if (newPassword.length < 8) {
      errs.next = 'Password must be at least 8 characters'
    } else if (!isPasswordRecovery && newPassword === currentPassword) {
      errs.next = 'New password must differ from current password'
    }
    if (newPassword !== confirmPassword) {
      errs.confirm = 'Passwords do not match'
    }
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      // Verify current password (skipped in recovery mode).
      if (!isPasswordRecovery) {
        if (!user?.email) {
          setError('Session email missing — please sign out and sign in again.')
          return
        }
        const ok = await verifyCurrentPassword(user.email, currentPassword)
        if (!ok) {
          setFieldErrors({ current: 'Current password is incorrect' })
          setCurrentPassword('')
          return
        }
      }
      await updatePassword(newPassword)
      // Success — clear form, clear recovery flag, toast.
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFieldErrors({})
      if (isPasswordRecovery) setPasswordRecovery(false)
      toast('Password updated', 'ok')
    } catch (err) {
      if (isPasswordRecovery && isRecoveryExpiredError(err)) {
        setRecoveryExpired(true)
      } else {
        const msg = err instanceof Error ? err.message : 'Could not update password'
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSignOutAndRestart = async () => {
    setPasswordRecovery(false)
    await signOut()
    window.location.href = '/login'
  }

  return (
    <section
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--bd)',
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
      }}
      aria-labelledby="change-password-heading"
    >
      <header className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(29,119,51,0.08)' }}
          aria-hidden="true"
        >
          <KeyRound size={18} color="var(--g1)" strokeWidth={2} />
        </div>
        <div>
          <h3
            id="change-password-heading"
            style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--f1)' }}
          >
            Change password
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--f3)', marginTop: 2 }}>
            {isPasswordRecovery
              ? 'Set a new password to regain full access to your account.'
              : 'Enter your current password, then choose a new one.'}
          </p>
        </div>
      </header>

      {recoveryExpired ? (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
            Reset link expired
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#b91c1c', marginTop: 4, marginBottom: 12 }}>
            Your password reset link has expired. Please sign in again and request a new one.
          </p>
          <button
            type="button"
            onClick={handleSignOutAndRestart}
            className="rounded-xl px-4 py-2"
            style={{
              background: '#b91c1c',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Sign out and request new link
          </button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {!isPasswordRecovery && (
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            error={fieldErrors.current}
            autoComplete="current-password"
            disabled={saving}
          />
        )}
        <PasswordField
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          error={fieldErrors.next}
          hint="Minimum 8 characters"
          autoComplete="new-password"
          disabled={saving}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          error={fieldErrors.confirm}
          autoComplete="new-password"
          disabled={saving}
        />

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-opacity"
            style={{
              background: 'var(--g1)',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
      )}
    </section>
  )
}

// ── Password field subcomponent ────────────────────────────────────────────────

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  error?: string
  hint?: string
  autoComplete: string
  disabled: boolean
}

function PasswordField({
  id, label, value, onChange, show, onToggleShow, error, hint, autoComplete, disabled,
}: PasswordFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--f2)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            padding: '9px 38px 9px 12px',
            borderRadius: 10,
            border: `1px solid ${error ? '#fecaca' : 'var(--bd)'}`,
            background: disabled ? '#f8fafc' : '#ffffff',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            background: 'transparent',
            border: 'none',
            color: 'var(--f3)',
            cursor: 'pointer',
          }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)', marginTop: 4 }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit.**

```bash
git add src/components/dashboard/panels/profile/ChangePasswordCard.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add ChangePasswordCard component

Self-contained password change form with current/new/confirm fields,
show-hide toggles, client-side validation, and recovery-mode branch
that hides the current-password field. Uses ephemeral-client
verification via authService.verifyCurrentPassword.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Build `ProfileDetailsCard.tsx`

**Files:**
- Create: `src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`

- [ ] **Step 1: Create the file with the full component.**

Write `src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`:

```typescript
import { useState, useMemo } from 'react'
import { UserCircle2, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { updateProfile } from '@/services/authService'
import { ROLES } from '@/constants'

export function ProfileDetailsCard() {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const setProfile = useAuthStore((s) => s.setProfile)
  const toast = useUIStore((s) => s.toast)

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [country, setCountry] = useState(profile?.country ?? '')
  const [institution, setInstitution] = useState(profile?.institution ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(() => {
    return (
      firstName !== (profile?.first_name ?? '') ||
      lastName !== (profile?.last_name ?? '') ||
      country !== (profile?.country ?? '') ||
      institution !== (profile?.institution ?? '')
    )
  }, [firstName, lastName, country, institution, profile])

  const firstNameTrimmed = firstName.trim()
  const lastNameTrimmed = lastName.trim()
  const valid = firstNameTrimmed.length >= 1 && lastNameTrimmed.length >= 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !user) return
    if (!dirty || !valid) return
    setError(null)
    setSaving(true)
    try {
      // Send trimmed values as-is (including empty strings) so clearing a
      // field actually persists. Falling back to `undefined` would drop the
      // key from the payload and leave the old value intact.
      const updated = await updateProfile(profile.id, {
        first_name: firstNameTrimmed,
        last_name: lastNameTrimmed,
        country: country.trim(),
        institution: institution.trim(),
      })
      setProfile(updated)
      toast('Profile saved', 'ok')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save profile'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const email = user?.email ?? profile?.email ?? ''
  const roleLabel = profile?.role ? ROLES[profile.role]?.label ?? profile.role : ''

  return (
    <section
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--bd)',
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
      }}
      aria-labelledby="profile-details-heading"
    >
      <header className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(29,119,51,0.08)' }}
          aria-hidden="true"
        >
          <UserCircle2 size={18} color="var(--g1)" strokeWidth={2} />
        </div>
        <div>
          <h3
            id="profile-details-heading"
            style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--f1)' }}
          >
            Profile details
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--f3)', marginTop: 2 }}>
            Your name, country, and institution. Email and role are managed by administrators.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Read-only: email + role */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReadOnlyRow label="Email" value={email} />
          <ReadOnlyRow label="Role" value={roleLabel} />
        </dl>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            id="first-name"
            label="First name"
            value={firstName}
            onChange={setFirstName}
            maxLength={100}
            required
            disabled={saving}
          />
          <TextField
            id="last-name"
            label="Last name"
            value={lastName}
            onChange={setLastName}
            maxLength={100}
            required
            disabled={saving}
          />
          <TextField
            id="country"
            label="Country"
            value={country}
            onChange={setCountry}
            maxLength={100}
            disabled={saving}
          />
          <TextField
            id="institution"
            label="Institution"
            value={institution}
            onChange={setInstitution}
            maxLength={200}
            disabled={saving}
          />
        </div>

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={!dirty || !valid || saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-opacity"
            style={{
              background: 'var(--g1)',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: !dirty || !valid || saving ? 'not-allowed' : 'pointer',
              opacity: !dirty || !valid || saving ? 0.5 : 1,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ── Read-only row ────────────────────────────────────────────────────────────

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--f3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--f2)',
          padding: '9px 12px',
          borderRadius: 10,
          background: '#f8fafc',
          border: '1px solid var(--bd)',
        }}
      >
        {value || '—'}
      </dd>
    </div>
  )
}

// ── Editable text field ──────────────────────────────────────────────────────

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  required?: boolean
  disabled?: boolean
}

function TextField({ id, label, value, onChange, maxLength, required, disabled }: TextFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--f2)',
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        disabled={disabled}
        style={{
          width: '100%',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          padding: '9px 12px',
          borderRadius: 10,
          border: '1px solid var(--bd)',
          background: disabled ? '#f8fafc' : '#ffffff',
          outline: 'none',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Verify that `@/constants` exports `ROLES` with a `label` field.**

Run: `git grep -n "export const ROLES" src/constants`
Expected: a match. If the shape doesn't include `label`, fall back to `profile.role` string as the display value (the component already has that fallback in `roleLabel`).

- [ ] **Step 4: Commit.**

```bash
git add src/components/dashboard/panels/profile/ProfileDetailsCard.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add ProfileDetailsCard component

Self-contained form for first_name, last_name, country, institution
with read-only email/role rows. Uses setProfile with the returned
row to avoid an extra fetch after save.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Build `ProfilePanel.tsx` shell with recovery banner

**Files:**
- Create: `src/components/dashboard/panels/ProfilePanel.tsx`

- [ ] **Step 1: Create the file.**

Write `src/components/dashboard/panels/ProfilePanel.tsx`:

```typescript
import { AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { ProfileDetailsCard } from './profile/ProfileDetailsCard'
import { ChangePasswordCard } from './profile/ChangePasswordCard'

export function ProfilePanel() {
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery)

  return (
    <div
      style={{
        padding: '28px 32px 40px',
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--f1)',
            letterSpacing: '-0.01em',
          }}
        >
          My profile
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--f3)',
            marginTop: 4,
          }}
        >
          Update your personal details and password.
        </p>
      </header>

      {isPasswordRecovery && (
        <div
          role="alert"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: '14px 16px',
            borderRadius: 12,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: '#92400e',
              }}
            >
              Please set a new password to continue.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: '#b45309',
                marginTop: 4,
              }}
            >
              Do not close or refresh this page until your new password is saved — the reset link cannot be reused.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <ProfileDetailsCard />
        <ChangePasswordCard />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit.**

```bash
git add src/components/dashboard/panels/ProfilePanel.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add ProfilePanel shell with recovery banner

Thin composition layer rendering ProfileDetailsCard and
ChangePasswordCard, plus a recovery-mode alert banner with
do-not-refresh warning copy.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: Wire into existing Dashboard shell

### Task 9: Add `profileFormDirty` flag to `uiStore`

**Files:**
- Modify: `src/stores/uiStore.ts`
- Modify: `src/types/index.ts` (if UIState is typed there; otherwise purely in uiStore.ts)

This flag lets the Sidebar intercept panel switches when the profile form has unsaved changes and route them through `ConfirmModal`. The flag lives in `uiStore` (not `authStore`) because it's pure UI state.

- [ ] **Step 1: Add `profileFormDirty` to `UIState` in `src/stores/uiStore.ts`.**

In the `UIState` interface, add:
```typescript
  profileFormDirty: boolean
  setProfileFormDirty: (dirty: boolean) => void
```

- [ ] **Step 2: Initialize the field and action in the store body.**

In the `create<UIState>` body, add `profileFormDirty: false,` next to the other initial state fields, and add the action below `setActivePanel`:
```typescript
  setProfileFormDirty: (profileFormDirty) => useUIStore.setState({ profileFormDirty }),
```

- [ ] **Step 3: Verify typecheck.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit.**

```bash
git add src/stores/uiStore.ts
git commit -m "$(cat <<'EOF'
feat(ui-store): add profileFormDirty flag

Lets the Sidebar intercept panel switches when the profile details
form has unsaved changes and confirm with the user before discarding.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wire `ProfileDetailsCard` to publish its dirty state

**Files:**
- Modify: `src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`

- [ ] **Step 1: Import and subscribe to the setter.**

At the top of the component, add to the `useUIStore` selectors:
```typescript
const setProfileFormDirty = useUIStore((s) => s.setProfileFormDirty)
```

- [ ] **Step 2: Publish dirty state via `useEffect`.**

Below the existing `dirty` `useMemo`, add:
```typescript
useEffect(() => {
  setProfileFormDirty(dirty)
  // Clear the flag when the card unmounts so a stale flag can't block nav.
  return () => setProfileFormDirty(false)
}, [dirty, setProfileFormDirty])
```

Add `useEffect` to the react import at the top of the file:
```typescript
import { useState, useMemo, useEffect } from 'react'
```

- [ ] **Step 3: Also clear the flag after a successful save.**

In `handleSubmit`, after `setProfile(updated)` and before `toast(...)`, add:
```typescript
setProfileFormDirty(false)
```

- [ ] **Step 4: Verify typecheck.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 5: Commit.**

```bash
git add src/components/dashboard/panels/profile/ProfileDetailsCard.tsx
git commit -m "$(cat <<'EOF'
feat(profile): publish dirty state to uiStore

Lets the Sidebar gate panel switches on unsaved profile changes.
Flag clears on unmount and on successful save.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Add Profile entry to Sidebar and gate `handleItemClick`

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Add the icon import.**

At the top of the file, add `UserCircle2` to the lucide-react imports:

```typescript
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Users,
  Settings2,
  Unplug,
  LogOut,
  Workflow,
  UserCircle2,
} from 'lucide-react'
```

- [ ] **Step 2: Add the Profile nav entry.**

In the `NAV_ITEMS` array (around lines 29-37), append a new entry at the end (after `app-flow`):

```typescript
{ id: 'profile',     label: 'My Profile',  Icon: UserCircle2,       panel: 'profile' },
```

The final array should read:

```typescript
const NAV_ITEMS: NavItem[] = [
  { id: 'overview',    label: 'Overview',    Icon: LayoutDashboard, panel: 'overview' },
  { id: 'survey',      label: 'My Survey',   Icon: ClipboardList,   opensSurvey: true },
  { id: 'reports',     label: 'Reports',     Icon: BarChart3,       panel: 'reports',     supervisorPlus: true },
  { id: 'users',       label: 'Users',       Icon: Users,           panel: 'users',       adminOnly: true },
  { id: 'survey-mgmt', label: 'Survey Mgmt', Icon: Settings2,       panel: 'survey-mgmt', adminOnly: true },
  { id: 'wa-settings', label: 'WA Settings', Icon: Unplug,          panel: 'wa-settings', adminOnly: true },
  { id: 'app-flow',    label: 'App Flow',    Icon: Workflow,         panel: 'app-flow',    adminOnly: true },
  { id: 'profile',     label: 'My Profile',  Icon: UserCircle2,      panel: 'profile' },
]
```

- [ ] **Step 3: Read `isPasswordRecovery` and the uiStore bits in the component.**

In `Sidebar()`, update the auth store destructure to include it:

```typescript
const { profile, isAdmin, canViewReports, signOut, isPasswordRecovery } = useAuthStore()
```

Also pull `profileFormDirty`, `openConfirmModal`, and `setProfileFormDirty` from the uiStore:

```typescript
const { activePanel, setActivePanel } = useUIStore()
const profileFormDirty = useUIStore((s) => s.profileFormDirty)
const openConfirmModal = useUIStore((s) => s.openConfirmModal)
const setProfileFormDirty = useUIStore((s) => s.setProfileFormDirty)
```

- [ ] **Step 4: Gate `handleItemClick` on recovery mode and dirty form.**

Replace the existing `handleItemClick` (lines 74-80) with:

```typescript
const handleItemClick = (item: NavItem) => {
  // During password recovery, only the profile panel is reachable.
  if (isPasswordRecovery && item.panel !== 'profile') return

  const performNavigation = () => {
    if (item.opensSurvey) {
      openModal()
    } else if (item.panel) {
      setActivePanel(item.panel)
    }
  }

  // If the user is leaving the profile panel with unsaved changes, confirm.
  const leavingProfile = activePanel === 'profile' && item.panel !== 'profile'
  if (leavingProfile && profileFormDirty) {
    openConfirmModal({
      title: 'Discard unsaved changes?',
      message: 'You have unsaved profile changes. Leave without saving?',
      variant: 'warning',
      onConfirm: () => {
        setProfileFormDirty(false)
        performNavigation()
      },
    })
    return
  }

  performNavigation()
}
```

- [ ] **Step 5: Visually mute non-profile nav items during recovery.**

In the nav-item render (inside `NAV_ITEMS.filter(isVisible).map(...)`), compute a disabled flag and apply it to the button's styling. Update the `.map` callback start:

```typescript
{NAV_ITEMS.filter(isVisible).map((item) => {
  const active = isActive(item)
  const disabled = isPasswordRecovery && item.panel !== 'profile'
  const { Icon } = item
```

Then update the button's style/aria:

```typescript
<button
  type="button"
  onClick={() => handleItemClick(item)}
  disabled={disabled}
  aria-disabled={disabled || undefined}
  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150"
  style={{
    background: active ? 'rgba(29,119,51,0.07)' : 'transparent',
    color: active ? 'var(--g1)' : 'var(--f2)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    outline: 'none',
    position: 'relative',
    opacity: disabled ? 0.4 : 1,
  }}
```

Leave the hover handlers intact — they already check `active` but not `disabled`; add the check:

```typescript
onMouseEnter={(e) => {
  if (!active && !disabled) {
    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(29,119,51,0.04)'
    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--f1)'
  }
}}
onMouseLeave={(e) => {
  if (!active && !disabled) {
    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--f2)'
  }
}}
```

**Note:** Leave the Sign Out button unchanged — sign-out remains available during recovery (user may legitimately abort and request a new link).

- [ ] **Step 6: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 7: Commit.**

```bash
git add src/components/dashboard/Sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): add Profile sidebar entry and recovery guard

Profile is visible to all roles. During password recovery, all
nav items except Profile are disabled (visually muted + early
return in handleItemClick). Sign-out stays available so users
can abort a recovery they did not initiate.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Register Profile panel in `DashboardPage` and add recovery auto-navigation

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add imports.**

Update the imports at the top:

```typescript
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { OverviewPanel } from '@/components/dashboard/panels/OverviewPanel'
import { ReportsPanel } from '@/components/dashboard/panels/ReportsPanel'
import { UsersPanel } from '@/components/dashboard/panels/UsersPanel'
import { SurveyMgmtPanel } from '@/components/dashboard/panels/SurveyMgmtPanel'
import { WASettingsPanel } from '@/components/dashboard/panels/WASettingsPanel'
import { AppFlowPanel } from '@/components/dashboard/panels/AppFlowPanel'
import { ProfilePanel } from '@/components/dashboard/panels/ProfilePanel'
import { SurveyModal } from '@/components/survey/SurveyModal'
import { WelcomeOverlay } from '@/components/common/WelcomeOverlay'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Nav } from '@/components/common/Nav'
```

- [ ] **Step 2: Read `isPasswordRecovery` from the store.**

Inside `DashboardPage()`, update the auth store destructure:

```typescript
const { session, profile, loading, isAdmin, canViewReports, isPasswordRecovery } = useAuthStore()
```

- [ ] **Step 3: Add the recovery auto-navigation effect with ref guard.**

Add this block below the existing admin-panel-safety-net `useEffect` (around line 37):

```typescript
// Password recovery: auto-navigate to the profile panel exactly once per
// activation. The ref gate prevents a loop if something else later tries
// to flip activePanel while recovery is active.
const didAutoNavRef = useRef(false)
useEffect(() => {
  if (isPasswordRecovery && !didAutoNavRef.current) {
    didAutoNavRef.current = true
    setActivePanel('profile')
  }
  if (!isPasswordRecovery) {
    didAutoNavRef.current = false
  }
}, [isPasswordRecovery, setActivePanel])
```

- [ ] **Step 4: Register the profile panel in the render tree.**

In the `<main>` render block, add the new panel line after `app-flow`:

```tsx
{activePanel === 'overview' && <OverviewPanel />}
{activePanel === 'reports' && canViewReports() && <ReportsPanel />}
{activePanel === 'users' && isAdmin() && <UsersPanel />}
{activePanel === 'survey-mgmt' && isAdmin() && <SurveyMgmtPanel />}
{activePanel === 'wa-settings' && isAdmin() && <WASettingsPanel />}
{activePanel === 'app-flow'    && isAdmin() && <AppFlowPanel />}
{activePanel === 'profile' && <ProfilePanel />}
```

- [ ] **Step 5: Update the admin-panel safety net to include the new panel in the whitelist.**

The existing safety net resets `activePanel` to `'overview'` when profile is briefly null and the current panel is admin-only. `'profile'` is not admin-only, so leave the `adminPanels` array unchanged. No edit needed here — documenting for reviewers.

- [ ] **Step 6: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 7: Commit.**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): register ProfilePanel and recovery auto-nav

DashboardPage now renders ProfilePanel when activePanel === 'profile'
and auto-navigates to it exactly once when isPasswordRecovery flips
to true. A ref gate prevents routing loops.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Block survey modal from opening during recovery

**Files:**
- Modify: `src/stores/surveyStore.ts` OR `src/components/dashboard/Sidebar.tsx` (whichever owns the `openModal` call path)

The Sidebar already gates the "My Survey" sidebar click via the `handleItemClick` guard in Task 11 (the `opensSurvey` item falls through the `item.panel !== 'profile'` check and is blocked). However, the survey modal can also be opened from other places (e.g. the Overview panel's "Start survey" button). To be thorough, we also gate at the store level.

- [ ] **Step 1: Search for `openModal` callers.**

Run: `git grep -n "openModal\(\)" src/`
Expected: list of call sites. Note all non-Sidebar callers — these are the concrete targets for the fallback if circular imports force per-caller guarding instead of a store-level guard.

- [ ] **Step 2: Open `src/stores/surveyStore.ts` and locate `openModal`.**

- [ ] **Step 3: Add a recovery guard inside `openModal`.**

Wrap the existing `openModal` body with:

```typescript
openModal: () => {
  // Block during password recovery — the user must finish setting a new
  // password before accessing the survey.
  if (useAuthStore.getState().isPasswordRecovery) return
  // ...existing body...
},
```

You will need to import `useAuthStore` at the top of `surveyStore.ts` if not already imported:

```typescript
import { useAuthStore } from './authStore'
```

If this creates a circular import (Zustand stores importing each other sometimes causes ordering issues), fall back to guarding at each caller instead. The Sidebar caller is already guarded; add a guard to any other caller discovered in Step 1.

- [ ] **Step 4: Verify typecheck passes.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 5: Commit.**

```bash
git add src/stores/surveyStore.ts
git commit -m "$(cat <<'EOF'
feat(survey): block survey modal during password recovery

Defence in depth: Sidebar already gates the My Survey click, but
openModal is also called from other surfaces. Gating at the store
level covers all call sites.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: Manual verification via preview

### Task 14: End-to-end preview verification

**Files:** none (manual verification only)

The codebase has no automated test harness. Verify each behavior via the Claude Preview dev server. If any step fails, stop and diagnose before moving on.

- [ ] **Step 1: Start the preview server.**

Use `preview_start` to launch the dev server from the worktree root.

- [ ] **Step 2: Verify the Profile entry appears in the sidebar (all roles).**

Sign in as any user. Use `preview_snapshot` to confirm "My Profile" is present in the left sidebar.

- [ ] **Step 3: Verify the panel renders.**

Use `preview_click` on the Profile sidebar entry. Use `preview_snapshot` to confirm:
- Heading "My profile"
- "Profile details" card with First name, Last name, Country, Institution inputs
- Read-only Email and Role rows
- "Change password" card with Current/New/Confirm password fields
- Save and Update password buttons

- [ ] **Step 4: Verify profile edit persists.**

Use `preview_fill` to change First name, click Save. Expect:
- Success toast "Profile saved"
- Form resets to clean state (button disables)
- After reloading with `preview_eval: window.location.reload()`, the new value is still shown.

Use `preview_console_logs` to confirm no errors.

- [ ] **Step 5: Verify password change with wrong current password.**

Fill Current password with a wrong value, a valid new password, matching confirm. Click Update password. Expect:
- Inline error "Current password is incorrect" under the Current password field
- That field clears
- Main session is unaffected — verify via `preview_eval: !!window.localStorage.getItem('sb-<project-ref>-auth-token')` returns true and the expiry timestamp inside did not change (or: just verify the user is still on the Profile panel and no sign-out occurred).

- [ ] **Step 6: Verify password change with correct current password.**

Fill Current password correctly, a new valid password, matching confirm. Click Update password. Expect:
- Success toast "Password updated"
- All three fields clear
- No error banner

- [ ] **Step 7: Verify validation — mismatched confirm.**

Fill new + different confirm. Click Update password. Expect:
- Inline error "Passwords do not match" under Confirm field
- No network request (check `preview_network`)

- [ ] **Step 8: Verify validation — short password.**

Fill a 5-character new password. Click Update password. Expect:
- Inline error "Password must be at least 8 characters"

- [ ] **Step 9: Verify forgot-password redirect is fixed.**

Sign out. On the sign-in page, click "Forgot password?" after entering a real email. Expect:
- Toast "Password reset email sent"
- No 404 behavior on the page itself (the redirect target is set correctly even if you don't receive the email in the preview environment)

To fully verify the PASSWORD_RECOVERY flow, manually: (a) trigger a reset email against a test account, (b) click the email link, (c) confirm the app lands on `/dashboard`, auto-navigates to Profile, hides the Current password field, shows the recovery banner, and allows password update. This step requires a live email round-trip and cannot be done entirely inside preview — note in the task log whether it was verified manually or deferred.

- [ ] **Step 10: Verify sidebar guard during recovery.**

(Manual, requires live recovery session from Step 9.) While `isPasswordRecovery === true`, attempt to click Overview, Reports, My Survey, Users (if admin). Expect:
- All non-Profile items are visually muted and do not respond to clicks.
- Sign Out remains clickable.

- [ ] **Step 10b: Verify dirty-form confirm modal on panel switch.**

Open Profile → edit First name → click Overview in the sidebar without saving. Expect: `ConfirmModal` appears with "Discard unsaved changes?" copy. Click Cancel → stays on Profile panel with form still dirty. Click the same item again → confirm → navigates to Overview and the form dirty flag clears. Re-open Profile → verify the form state was discarded (shows the original values from the store).

- [ ] **Step 11: Verify dirty-form edit is preserved on retry after error.**

Edit First name but disconnect network (or use `preview_eval` to simulate an error by setting an invalid profile.id temporarily — skip this if not practical). Confirm the form stays dirty with the user's input after an error.

- [ ] **Step 12: Take a final screenshot for the PR.**

Use `preview_screenshot` of the full Profile panel in normal mode. Save for the PR description.

- [ ] **Step 13: Stop the preview.**

Use `preview_stop`.

- [ ] **Step 14: Final commit (if any manual fixes were needed during verification).**

Only commit if Step 1-13 surfaced issues that required code changes. Otherwise the feature is complete.

---

## Done

At the end of Task 12, all files in the Files Summary section of the spec are implemented, committed, and verified. The branch `feature/auth-and-content-updates` is ready for a PR against `main`.

**PR title suggestion:** `feat: user profile panel and password change`

**PR body suggestion:**
```
## Summary
- New "My Profile" sidebar panel (all users) for editing name/country/institution and changing password
- Fixes broken forgot-password flow: reset link was redirecting to /auth (a 404 route); now uses /dashboard with PASSWORD_RECOVERY auth event
- Requires current password for normal password changes (verified via ephemeral Supabase client to avoid main-session side effects)
- Auto-navigates to profile panel during password recovery with guarded sidebar

## Test plan
- [ ] Profile edit persists across reload
- [ ] Password change with correct current password succeeds
- [ ] Password change with wrong current password shows inline error, does not affect main session
- [ ] Validation: mismatched confirm, <8 char password
- [ ] Forgot-password email round-trip lands on dashboard and auto-opens profile panel
- [ ] Recovery banner visible during PASSWORD_RECOVERY
- [ ] Sidebar guard blocks non-profile nav during recovery
- [ ] Sign-out remains available during recovery

Spec: docs/superpowers/specs/2026-04-05-user-profile-password-design.md
Plan: docs/superpowers/plans/2026-04-05-user-profile-password.md
```
