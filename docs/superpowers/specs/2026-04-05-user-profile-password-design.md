# User Profile Panel + Password Change

**Status:** Design
**Date:** 2026-04-05
**Branch:** feature/auth-and-content-updates

## Problem

Users of the IFFS 2026 Triennial Survey app have no way to:

1. View or edit their own profile information (first name, last name, country, institution).
2. Change their password from inside the app.
3. Complete a password reset. The "Forgot password?" link in `SignInForm` calls `supabase.auth.resetPasswordForEmail` with `redirectTo: ${origin}/auth?mode=reset`, but the app has **no `/auth` route** — `src/App.tsx` only defines `/`, `/login`, `/dashboard`, and legal pages. The reset link therefore 404s via the catch-all route. Supabase still parses the recovery token from the URL hash and establishes a recovery session in the background, but the user sees a NotFoundPage and has no way to set a new password. The flow is silently broken. There is also a stale, unused `resetPasswordForEmail` export in `src/services/authService.ts` that redirects to `/login?mode=reset` — the two paths disagree.

This design introduces a self-service Profile panel that addresses all three gaps in one coherent feature, plus fixes the broken recovery flow as a necessary side effect.

## Non-Goals

Explicitly out of scope (YAGNI):

- Profile picture / avatar upload.
- Two-factor authentication setup.
- Session management ("log out all devices").
- Account deletion / self-service account closure.
- Editing email address (would require re-verification; admin-managed for now).
- Editing role (already blocked by RLS; remains admin-managed).
- Displaying `wa_member_id` / `wa_verified` fields (admin-managed, noise for end users).
- Audit log of profile changes.
- Automated tests (no frontend test harness currently exists in this codebase; adding one is a separate decision).

## Scope

**Editable by the user:** `first_name`, `last_name`, `country`, `institution`.

**Read-only for the user:** `email`, `role` (both admin-managed).

**Password change:** requires current password + new password + confirm new password in normal flows. The "current password" requirement is bypassed during `PASSWORD_RECOVERY` sessions (the user forgot their password — that is the whole point).

**Visible to:** all authenticated users, regardless of role.

## UI Placement & Rationale

The Profile panel is a **new entry in the Dashboard left sidebar**, positioned alongside existing panels (Overview, Reports, Users, etc.), visible to all roles.

Alternatives considered and rejected:

- **Top-bar avatar dropdown** — this app's top bar (`Nav`) is a status/branding strip, not a navigation surface. All navigation happens in the sidebar. Adding a dropdown introduces a second, competing navigation system for one feature, requires building dropdown/focus-trap/outside-click infrastructure that doesn't exist yet, and splits the admin mental model (manage other users in sidebar, manage self in top-right).
- **Modal over the current panel** — two distinct concerns (details + password) is cramped in a modal; modals-over-modals get awkward mid-survey; harder to auto-route to during recovery mode.

The sidebar panel pattern is what the codebase already uses for every other feature. Consistency wins.

## Component Architecture

### New files

**`src/components/dashboard/panels/ProfilePanel.tsx`**
Thin composition layer. Reads `profile` and `isPasswordRecovery` from `useAuthStore`, renders a recovery banner (when applicable) plus `ProfileDetailsCard` and `ChangePasswordCard` stacked vertically in a scrollable container. Owns no form state.

**`src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`**
Self-contained form card for profile details.
- Local state: `first_name`, `last_name`, `country`, `institution`, plus `dirty`, `saving`, `error`.
- Read-only rows: `email` (from `user.email` in auth store) and `role` rendered as `<dt>/<dd>` pairs with muted styling.
- Submit: calls `authService.updateProfile(user.id, { ... })`. On success, pushes the returned row into the store via `setProfile(returnedRow)` — no extra fetch.
- Feedback: success toast ("Profile saved") via the existing `Toaster` / `uiStore` toast system. Inline error message at the bottom of the card on failure (keeps form state so user doesn't lose input).
- Save button disabled until form is dirty and all required fields pass validation.

**`src/components/dashboard/panels/profile/ChangePasswordCard.tsx`**
Self-contained form card for password change.
- Local state: `currentPassword`, `newPassword`, `confirmPassword`, plus `saving`, `error`, `fieldErrors`, `showCurrent`, `showNew`, `showConfirm`.
- Reads `isPasswordRecovery` from `useAuthStore` and conditionally hides the "Current password" field.
- Client-side validation runs before any network call (see Validation section).
- Submit flow: verify current password (skipped in recovery mode) → call `updatePassword` → clear form and recovery flag.
- Each password field has a show/hide eye toggle.
- Feedback: success toast ("Password updated"). Inline errors for validation and submission failures.

### Modified files

**`src/services/authService.ts`** — add two functions, delete the stale `resetPasswordForEmail` export (the active caller is `SignInForm` which calls Supabase directly; see below).

```typescript
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  // Use an ephemeral Supabase client that does NOT share storage with the
  // main app. This isolates verification so it cannot:
  //   - clobber the active session in localStorage
  //   - fire SIGNED_IN on the main auth listener (which would trigger an
  //     unwanted profile re-fetch)
  //   - reset the main session's expiry clock
  //   - interfere with an in-flight PASSWORD_RECOVERY session
  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await tempClient.auth.signInWithPassword({ email, password })
  return !error
}
```

The ephemeral-client approach is the key departure from a naive implementation. Calling `signInWithPassword` on the main client while already signed in would emit `SIGNED_IN` (triggering a profile refetch in the existing `authStore` listener), rotate the refresh token in localStorage, and reset the expiry clock. The isolated client avoids all of that while still using Supabase as the source of truth for password verification. Rate-limit note: failed attempts still count against Supabase's auth rate limiter for that email, which is a desired behavior (prevents brute-force).

**`src/stores/authStore.ts`** — add recovery state and a new branch inside the **existing** `onAuthStateChange` callback (not a second subscription, which would cause double-firing and cleanup problems):

- New field: `isPasswordRecovery: boolean` (default `false`).
- New action: `setPasswordRecovery(flag: boolean)`.
- In the existing `onAuthStateChange` callback, add an early branch: `if (event === 'PASSWORD_RECOVERY') { set({ session, user: session?.user ?? null, isPasswordRecovery: true, loading: false }); return }`. This MUST short-circuit before the `SIGNED_IN`/`USER_UPDATED` re-fetch branch — recovery sessions are for the same user, so a re-fetch is unnecessary and would race with the recovery UX.

**`src/components/dashboard/Sidebar.tsx`** — add a "Profile" entry visible to all roles (no role guard). Update `handleItemClick` (or its equivalent): when `isPasswordRecovery` is true, early-return for every click target except `'profile'`. Visual state: all other sidebar items rendered muted/disabled.

**`src/pages/DashboardPage.tsx`** — register the new `profile` panel: add `import { ProfilePanel } from '@/components/dashboard/panels/ProfilePanel'` and a `{activePanel === 'profile' && <ProfilePanel />}` render branch. Panels in this file are statically imported (not lazy-loaded), so follow that convention.

Add a recovery auto-navigation effect:
```typescript
const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)
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
The ref ensures the effect fires exactly once per recovery activation, preventing a routing loop if a user somehow changes `activePanel` while recovery is active.

Also block the survey modal during recovery: in the existing `SurveyModal` open logic (or wherever `openModal` is called from `Sidebar`), early-return if `isPasswordRecovery === true`.

**`src/components/auth/SignInForm.tsx`** — fix the broken `redirectTo` URL. Change `${origin}/auth?mode=reset` to `${origin}/dashboard`. Rationale: Supabase parses the recovery token from the URL hash regardless of query params, establishes a recovery session, and fires `PASSWORD_RECOVERY` via `onAuthStateChange`. Our new listener picks it up and `DashboardPage`'s effect routes to the profile panel. No `mode=reset` query param is needed because the auth event is the source of truth. Landing on `/dashboard` also means `AuthGuard` passes (recovery session is a valid session) and no redirect bounce through `/login` → `AuthRedirect`.

**`src/types/index.ts`** — extend the `ActivePanel` union:
```typescript
export type ActivePanel =
  | 'overview'
  | 'reports'
  | 'users'
  | 'survey-mgmt'
  | 'wa-settings'
  | 'app-flow'
  | 'profile'   // new
```
Also update any types that depend on this (`NavItem.id` in `Sidebar.tsx` is `ActivePanel | 'survey'`, which inherits automatically).

### Why two cards as separate files

Each card is roughly 100-150 lines with its own form state, validation, async submit handler, and feedback UI. Keeping them as separate files:

- Keeps `ProfilePanel.tsx` as a thin composition layer.
- Matches the existing pattern of small focused panel components.
- Isolates the recovery-mode branching to one file (`ChangePasswordCard`).
- Lets each card own its state without prop drilling or a shared context.

## Data Flow

### Normal profile edit

1. User opens Profile panel. `ProfileDetailsCard` reads `profile` from `useAuthStore` and seeds local form state.
2. User edits a field. Local state updates. `dirty` becomes true. Save button enables.
3. User clicks Save. Card calls `authService.updateProfile(user.id, { first_name, last_name, country, institution })`.
4. RLS policy `profiles_update_own` allows the write — `role` is unchanged (not in the payload), so the `with check (role = get_user_role(auth.uid()))` clause passes.
5. On success: card calls `setProfile(returnedRow)` to update the cached profile, shows a "Profile saved" toast, resets `dirty`.
6. On error: inline error message at the bottom of the card; form stays dirty.

### Normal password change

1. User fills current + new + confirm in `ChangePasswordCard`.
2. Client-side validation: new length ≥ 8, new ≠ current, new === confirm. Failures shown as inline field errors, no network call.
3. Card calls `authService.verifyCurrentPassword(user.email, currentPassword)` where `user.email` is taken from `authStore.user` (the Supabase session user, not `profile.email`, which is a cached copy in the `profiles` table and could theoretically drift).
4. On `false`: inline error "Current password is incorrect" under the current password field; that field clears.
5. On `true`: card calls `authService.updatePassword(newPassword)` → `supabase.auth.updateUser({ password })`.
6. On success: clear all three fields, show "Password updated" toast.
7. On failure: inline error at the bottom of the card with the Supabase error message.

### Password recovery flow (fixes existing broken behavior)

1. User clicks "Forgot password?" in `SignInForm` → Supabase sends reset email with link to `${origin}/dashboard`.
2. User clicks email link → Supabase parses the recovery token from the URL hash, establishes a recovery session, and lands on `/dashboard`. `AuthGuard` passes because a session exists.
3. Supabase fires `onAuthStateChange` with `event === 'PASSWORD_RECOVERY'`.
4. `authStore`'s listener catches this in the new branch and sets `isPasswordRecovery = true`.
5. `DashboardPage`'s auto-navigation effect sees the flag flip, fires once (gated by `didAutoNavRef`), and calls `setActivePanel('profile')`.
6. `ProfilePanel` renders a banner with `role="alert"`: *"Please set a new password to continue."*
7. `ChangePasswordCard` reads `isPasswordRecovery === true` → hides the "Current password" field and skips `verifyCurrentPassword` in its submit handler.
8. **Guard rail:** while `isPasswordRecovery === true`, `Sidebar.handleItemClick` early-returns for every target except `'profile'`, and `SurveyModal` open calls early-return. All other sidebar items render muted.
9. On successful `updatePassword`, the card calls `authStore.setPasswordRecovery(false)`. The guard rail lifts; the ref resets; normal navigation resumes.

### Recovery-mode edge cases

- **User closes tab mid-recovery:** on next visit Supabase recovery session has expired → user is signed out → they must request another reset email.
- **User tries to navigate away during recovery:** blocked at the `Sidebar.handleItemClick` level (not just visually). Survey modal is also blocked.
- **Recovery session expires mid-update:** Supabase returns an auth error from `updatePassword` → card shows "Reset link expired — please request a new one" with a button that signs out and routes to `/login`.
- **`PASSWORD_RECOVERY` event fires for an already-signed-in user** (edge case where the same account is used in two tabs): the flag still sets, recovery flow engages. Harmless — same user, same claims.
- **User refreshes page during recovery:** on reload, `getSession()` finds the recovery session but no `PASSWORD_RECOVERY` event is re-fired by Supabase (the event is delivered once, when the token is first parsed). This means `isPasswordRecovery` will be `false` after refresh. Accepted trade-off: if the user refreshes, they return to a normal authenticated view and would need to use the in-app password-change form with their current password, which they don't know. Mitigation: the banner should tell them not to refresh ("Do not close or refresh this page until you have set a new password"). A more robust fix (persist the flag in `sessionStorage` keyed to the recovery session's JTI) is deferred as out of scope.

### Normal-mode edge cases

- **Unsaved changes on panel switch:** if the details form is dirty and the user clicks another sidebar item, show a confirm dialog via the existing `ConfirmModal` system: "Discard unsaved profile changes?" — reuses the same confirm UX the app already uses elsewhere.
- **Admin updates user's role mid-edit:** harmless. The user's save payload doesn't include `role`, so RLS `with check` evaluates the row's new (admin-set) role against `get_user_role(auth.uid())` and passes.
- **Session expiry mid-save:** Supabase returns an auth error → surface it as the card's inline error. Form state preserved so user can retry after re-auth.
- **Concurrent edit in two tabs:** last write wins (standard Supabase behavior). Not worth optimistic-locking for this scale.

## Validation Rules

### Profile details

| Field | Required | Rules |
|---|---|---|
| `first_name` | yes | trimmed, 1-100 chars |
| `last_name` | yes | trimmed, 1-100 chars |
| `country` | no | free-text input, max 100 chars. Note: `profiles.country` is a `text` column storing the user's affiliation country (set at sign-up or by admin). This is intentionally distinct from the survey's country picker, which stores complex JSONB objects in `survey_submissions.data` — the two fields serve different purposes and must not share storage formats. |
| `institution` | no | trimmed, max 200 chars |

### Password

| Rule | Message |
|---|---|
| New password ≥ 8 chars | "Password must be at least 8 characters" |
| New password ≠ current password | "New password must differ from current password" (skipped in recovery mode) |
| New password === confirm | "Passwords do not match" |

Raising the minimum from Supabase's default of 6 to 8. No complexity requirements — length is what matters and complexity rules just push users to predictable substitutions.

## Error Handling

- **RLS / network errors from `updateProfile`:** inline error at bottom of card with the Supabase error message. Form stays dirty.
- **`verifyCurrentPassword` returns false:** inline field-level error "Current password is incorrect"; only that field clears.
- **`updatePassword` fails:** inline error at bottom of password card with Supabase message. Form state preserved.
- **Recovery session expired:** specific error message with a "Sign out and request new link" button.
- **Success feedback:** reuse the existing `Toaster` / `uiStore` toast system (`ToastMessage` type already defined, `Toaster` component already mounted in `App.tsx`). No new UI infrastructure.
- **Loading:** buttons show spinners and disable during async operations.

## Accessibility

- All form fields have proper `<label>` elements, not placeholder-as-label.
- Password fields are `type="password"` with a show/hide eye toggle.
- Error messages use `aria-describedby` linking back to their field.
- Recovery-mode banner uses `role="alert"` so screen readers announce it.
- Save buttons have accessible disabled states.

## Styling

Reuse existing dashboard card/form/button classes (see `ReportsPanel`, `UsersPanel`). No new design tokens. Cards match existing border/shadow/padding. Read-only rows use muted text to visually distinguish them from editable inputs.

## RLS & Security Notes

No schema changes. No migration required. Existing RLS policies already support this feature:

- `profiles_select_own` — user reads own profile.
- `profiles_update_own` — user updates own profile; the `with check` clause (from `supabase/migrations/004_fix_rls_recursion.sql`) enforces `role = get_user_role(auth.uid())`, so users cannot escalate their own role even if they POST a modified role value.

Password changes go through Supabase Auth, not the `profiles` table, so RLS is not involved. Requiring the current password is an app-level protection against "unlocked laptop" and "session hijacked but attacker does not know password" scenarios — important for an app holding IFFS member data. The ephemeral-client verification approach (see `verifyCurrentPassword` above) keeps this protection in place without the side effects of re-authenticating on the main client.

## Testing Approach

Manual verification via the preview dev server:

1. Sign in as a normal user → open Profile panel → edit name/country/institution → save → reload page → verify changes persisted.
2. Change password with correct current password → sign out → sign in with new password.
3. Attempt password change with wrong current password → verify inline error, field clears, main session is unaffected (no spurious re-fetches, expiry clock unchanged).
4. Attempt password change with mismatched confirm → verify inline error, no network call.
5. Request password reset email → click link → verify `/dashboard` loads, Profile panel auto-opens with current-password field hidden and recovery banner visible → set new password → verify normal navigation resumes.
6. During recovery mode, attempt to click other sidebar items → verify nothing happens. Attempt to open survey modal → verify nothing happens.
7. Sign in as admin → verify Profile panel is visible alongside admin panels → verify role field is read-only.
8. Dirty-form panel switch → verify confirm dialog appears.

No automated tests added — consistent with current codebase conventions.

## Files Summary

**New:**
- `src/components/dashboard/panels/ProfilePanel.tsx`
- `src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`
- `src/components/dashboard/panels/profile/ChangePasswordCard.tsx`

**Modified:**
- `src/services/authService.ts` — add `updatePassword`, `verifyCurrentPassword` (ephemeral client); delete stale `resetPasswordForEmail`.
- `src/stores/authStore.ts` — add `isPasswordRecovery` + `setPasswordRecovery`; add `PASSWORD_RECOVERY` branch inside existing `onAuthStateChange` callback (NOT a second subscription).
- `src/components/dashboard/Sidebar.tsx` — add Profile nav entry (all roles); gate `handleItemClick` on `isPasswordRecovery`.
- `src/pages/DashboardPage.tsx` — register profile panel (static import); add recovery auto-navigation effect with ref guard; block survey modal during recovery.
- `src/components/auth/SignInForm.tsx` — fix `redirectTo` from `${origin}/auth?mode=reset` to `${origin}/dashboard`.
- `src/types/index.ts` — add `'profile'` to `ActivePanel` union.

**Unchanged:**
- `profiles` table schema.
- RLS policies.
- Toast / confirm-modal infrastructure (reused, not extended).
