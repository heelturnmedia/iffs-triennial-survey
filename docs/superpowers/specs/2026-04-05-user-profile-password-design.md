# User Profile Panel + Password Change

**Status:** Design
**Date:** 2026-04-05
**Branch:** feature/auth-and-content-updates

## Problem

Users of the IFFS 2026 Triennial Survey app have no way to:

1. View or edit their own profile information (first name, last name, country, institution).
2. Change their password from inside the app.
3. Complete a password reset. The "Forgot password?" link in `SignInForm` does send a Supabase reset email that redirects to `/auth?mode=reset`, but nothing in the app currently reads that query param or listens for the `PASSWORD_RECOVERY` auth event — a user clicking the reset link lands on the app with a valid recovery session and is never prompted to set a new password. The flow is silently broken.

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

The Profile panel is a **new entry in the Dashboard left sidebar**, positioned alongside existing panels (Overview, My Survey, Reports, etc.), visible to all roles.

Alternatives considered and rejected:

- **Top-bar avatar dropdown** — this app's top bar is a status/branding strip, not a navigation surface. All navigation happens in the sidebar. Adding a dropdown introduces a second, competing navigation system for one feature, requires building dropdown/focus-trap/outside-click infrastructure that doesn't exist yet, and splits the admin mental model (manage other users in sidebar, manage self in top-right).
- **Modal over the current panel** — two distinct concerns (details + password) is cramped in a modal; modals-over-modals get awkward mid-survey; harder to deep-link or auto-route to during recovery mode.

The sidebar panel pattern is what the codebase already uses for every other feature. Consistency wins.

## Component Architecture

### New files

**`src/components/dashboard/panels/ProfilePanel.tsx`**
Thin composition layer. Reads `profile` from `useAuthStore`, renders `ProfileDetailsCard` and `ChangePasswordCard` stacked vertically in a scrollable container. Owns no form state. Reads `isPasswordRecovery` from the auth store to conditionally render the recovery banner at the top.

**`src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`**
Self-contained form card for profile details.
- Local state: `first_name`, `last_name`, `country`, `institution`, plus `dirty`, `saving`, `error`, `successVisible`.
- Read-only rows: `email`, `role` rendered as `<dt>/<dd>` pairs with muted styling.
- Submit: calls `authService.updateProfile(user.id, { ... })`, then `authStore.refreshProfile()` on success.
- Feedback: inline "Saved" text next to the save button, auto-clears after 2 seconds. Inline error message at the bottom of the card on failure.
- Save button disabled until form is dirty and all required fields pass validation.

**`src/components/dashboard/panels/profile/ChangePasswordCard.tsx`**
Self-contained form card for password change.
- Local state: `currentPassword`, `newPassword`, `confirmPassword`, plus `saving`, `error`, `fieldErrors`, `successVisible`, `showCurrent`, `showNew`, `showConfirm`.
- Reads `isPasswordRecovery` from `useAuthStore` and conditionally hides the "Current password" field.
- Client-side validation runs before any network call (see Validation section).
- Submit flow: verify current password (skipped in recovery mode) → call `updatePassword` → clear form and flag.
- Each password field has a show/hide eye toggle for usability.

### Modified files

**`src/services/authService.ts`** — add two functions:

```typescript
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}
```

Note: `verifyCurrentPassword` issues a fresh session on success. Since it's the same user with the same claims, this is harmless — Supabase handles token rotation transparently.

**`src/stores/authStore.ts`** — add recovery mode state:

- New field: `isPasswordRecovery: boolean` (default `false`).
- New action: `setPasswordRecovery(flag: boolean)`.
- On store initialization, register a `supabase.auth.onAuthStateChange` listener that sets `isPasswordRecovery = true` when `event === 'PASSWORD_RECOVERY'`.
- New action: `refreshProfile()` if not already present — re-fetches the user's profile row and updates cached state.

**`src/components/dashboard/Sidebar.tsx`** — add a "Profile" entry visible to all roles (no role guard), with an appropriate icon from the existing icon set.

**`src/components/dashboard/Dashboard.tsx`** (or wherever the panel router lives) — register the new `profile` panel key, lazy-load `ProfilePanel`. Add an effect that watches `isPasswordRecovery`: when it flips to `true`, force-navigate to the profile panel and scroll the password card into view.

### Why two cards as separate files

Each card is roughly 100-150 lines with its own form state, validation, async submit handler, and feedback UI. Keeping them as separate files:

- Keeps `ProfilePanel.tsx` as a thin composition layer (easy to read in one glance).
- Matches the existing pattern of small focused panel components.
- Isolates the recovery-mode branching to one file (`ChangePasswordCard`).
- Lets each card own its state without prop drilling or a shared context.

## Data Flow

### Normal profile edit

1. User opens Profile panel. `ProfileDetailsCard` reads `profile` from `useAuthStore` and seeds local form state.
2. User edits a field. Local state updates. `dirty` becomes true. Save button enables.
3. User clicks Save. Card calls `authService.updateProfile(user.id, { first_name, last_name, country, institution })`.
4. RLS policy `profiles_update_own` allows the write — `role` is unchanged, so the `with check` clause passes.
5. On success: card calls `authStore.refreshProfile()`, shows "Saved" inline for 2 seconds, resets `dirty` to false.
6. On error: inline error message at the bottom of the card; form stays dirty so the user does not lose input.

### Normal password change

1. User fills current + new + confirm in `ChangePasswordCard`.
2. Client-side validation: new length ≥ 8, new ≠ current, new === confirm. Failures shown as inline field errors, no network call.
3. Card calls `authService.verifyCurrentPassword(user.email, currentPassword)`.
4. On `false`: inline error "Current password is incorrect" under the current password field; that field clears.
5. On `true`: card calls `authService.updatePassword(newPassword)` → `supabase.auth.updateUser({ password })`.
6. On success: clear all three fields, show "Password updated" inline for 2 seconds.
7. On failure: inline error at the bottom of the card with the Supabase error message; form state preserved.

### Password recovery flow (fixes existing broken behavior)

1. User clicks "Forgot password?" in `SignInForm` → Supabase sends reset email with link to `/auth?mode=reset`. *(Existing behavior, unchanged.)*
2. User clicks email link → lands on app with valid recovery session. Supabase fires `onAuthStateChange` with `event === 'PASSWORD_RECOVERY'`.
3. **New:** `authStore`'s listener catches this event and sets `isPasswordRecovery = true`.
4. **New:** The top-level effect in `Dashboard.tsx` watches `isPasswordRecovery`. When true, it force-navigates to the Profile panel and auto-scrolls to the password card.
5. `ChangePasswordCard` reads `isPasswordRecovery` from the store → hides the "Current password" field and skips `verifyCurrentPassword` in its submit handler.
6. **Guard rail:** while `isPasswordRecovery === true`, the sidebar disables all other panel entries (visual: muted, click does nothing) and a banner appears at the top of the Profile panel with `role="alert"`: *"Please set a new password to continue."* This prevents a confused user from wandering off and leaving their account in a half-reset state.
7. On successful `updatePassword`, the card calls `authStore.setPasswordRecovery(false)`. The guard rail lifts; normal navigation resumes.

### Recovery-mode edge cases

- **User closes tab mid-recovery:** on next visit Supabase recovery session has expired → user is signed out → they must request another reset email.
- **User tries to navigate away during recovery:** sidebar guard blocks clicks; auto-navigation effect routes them back to the Profile panel on any attempted panel switch.
- **Recovery session expires mid-update:** Supabase returns an auth error from `updatePassword` → card shows "Reset link expired — please request a new one" with a button that signs out and routes to `/auth`.
- **`PASSWORD_RECOVERY` event fires when the user was already signed in normally** (unlikely but possible): the flag still sets, recovery flow engages, same UX as a cold recovery. Harmless.

## Validation Rules

### Profile details

| Field | Required | Rules |
|---|---|---|
| `first_name` | yes | trimmed, 1-100 chars |
| `last_name` | yes | trimmed, 1-100 chars |
| `country` | no | free-text input, max 100 chars; **not** the SurveyJS country picker (that stores JSON objects; `profiles.country` is `text`) |
| `institution` | no | trimmed, max 200 chars |

### Password

| Rule | Message |
|---|---|
| New password ≥ 8 chars | "Password must be at least 8 characters" |
| New password ≠ current password | "New password must differ from current password" (skipped in recovery mode) |
| New password === confirm | "Passwords do not match" |

Raising the minimum from Supabase's default of 6 to 8. No complexity requirements (no forced mixed case, symbols, digits) — length is what matters and complexity rules just push users to predictable substitutions.

## Error Handling

- **RLS / network errors from `updateProfile`:** inline error at bottom of card with the Supabase error message. Form stays dirty.
- **`verifyCurrentPassword` returns false:** inline field-level error "Current password is incorrect"; only that field clears.
- **`updatePassword` fails:** inline error at bottom of password card with Supabase message. Form state preserved so user can retry.
- **Recovery session expired:** specific error message with a "Sign out and request new link" button.
- **Success feedback:** small inline text next to the relevant button, auto-clears after 2 seconds. Buttons show spinners during async operations. No toast system added — this app does not have one and two success messages do not justify introducing one.

## Accessibility

- All form fields have proper `<label>` elements, not placeholder-as-label.
- Password fields are `type="password"` with a show/hide eye toggle.
- Error messages use `aria-describedby` linking back to their field.
- Recovery-mode banner uses `role="alert"` so screen readers announce it.
- Save buttons have accessible disabled states (not just visual).

## Styling

Reuse existing dashboard card/form/button classes (see `ReportsPanel`, `UsersPanel`). No new design tokens. Cards match existing border/shadow/padding. Read-only rows use muted text color to visually distinguish them from editable inputs.

## RLS & Security Notes

No schema changes. No migration required. Existing RLS policies already support this feature:

- `profiles_select_own` — user reads own profile.
- `profiles_update_own` — user updates own profile; the `with check` clause enforces `role = get_user_role(auth.uid())`, so users cannot escalate their own role even if they POST a modified role value.

Password changes go through Supabase Auth, not the `profiles` table, so RLS is not involved. Requiring the current password is an app-level protection against "unlocked laptop" and "session hijacked but attacker does not know password" scenarios — important for an app holding IFFS member data.

## Testing Approach

Manual verification via the preview dev server:

1. Sign in as a normal user → open Profile panel → edit name/country/institution → save → reload page → verify changes persisted.
2. Change password with correct current password → sign out → sign in with new password.
3. Attempt password change with wrong current password → verify inline error, field clears.
4. Attempt password change with mismatched confirm → verify inline error, no network call.
5. Request password reset email → click link → verify Profile panel opens with current-password field hidden and recovery banner visible → set new password → verify normal navigation resumes.
6. Sign in as admin → verify Profile panel is visible alongside admin panels → verify role field is read-only.
7. Verify other users' panels are disabled during recovery mode (sidebar guard).

No automated tests added — consistent with current codebase conventions.

## Files Summary

**New:**
- `src/components/dashboard/panels/ProfilePanel.tsx`
- `src/components/dashboard/panels/profile/ProfileDetailsCard.tsx`
- `src/components/dashboard/panels/profile/ChangePasswordCard.tsx`

**Modified:**
- `src/services/authService.ts` — add `updatePassword`, `verifyCurrentPassword`
- `src/stores/authStore.ts` — add `isPasswordRecovery` state + `PASSWORD_RECOVERY` listener
- `src/components/dashboard/Sidebar.tsx` — add Profile entry (all roles)
- `src/components/dashboard/Dashboard.tsx` — register panel + recovery auto-navigation effect

**Unchanged:**
- `profiles` table schema
- RLS policies
- `SignInForm` forgot-password UI (already works correctly, only the landing behavior was broken)
