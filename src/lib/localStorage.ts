import type { Profile, SurveyProgress } from '../types';
import { SURVEY } from '../constants';

// ─── Cached profile ──────────────────────────────────────
// The user's role lives in the `profiles` table, one network round-trip behind
// the session. Until it lands, isAdmin() is false and the admin navigation is
// hidden — which is why the admin panels visibly "appear a moment later" after
// signing in. Caching the profile lets the correct menu render on the very
// first paint of a return visit; the store still refetches in the background
// and overwrites this, so a role change is picked up on the next load.
//
// Only display/role data is stored — never tokens. Cleared on sign-out.

const PROFILE_KEY = 'iffs-cached-profile';

export function cacheProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage quota exceeded or unavailable — fail silently
  }
}

/** Cached profile for `userId`, or null. Ignores a cache from another account. */
export function loadCachedProfile(userId?: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as Profile;
    if (!profile?.id) return null;
    if (userId && profile.id !== userId) return null;
    return profile;
  } catch {
    return null;
  }
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Fail silently
  }
}

// ─── Survey Progress ─────────────────────────────────────

export function surveyKey(email: string): string {
  return `${SURVEY.LS_PREFIX}${email}`;
}

export function persistSurvey(email: string, progress: SurveyProgress): void {
  try {
    localStorage.setItem(surveyKey(email), JSON.stringify(progress));
  } catch {
    // Storage quota exceeded or unavailable — fail silently
  }
}

export function loadPersistedSurvey(email: string): SurveyProgress | null {
  try {
    const raw = localStorage.getItem(surveyKey(email));
    if (!raw) return null;
    return JSON.parse(raw) as SurveyProgress;
  } catch {
    return null;
  }
}

export function clearPersistedSurvey(email: string): void {
  try {
    localStorage.removeItem(surveyKey(email));
  } catch {
    // Fail silently
  }
}

// Privacy: on sign-out, remove every survey draft from this browser — not just
// the current user's. Shared clinic/university machines must not retain any
// participant's answers after a sign-out.
export function clearAllPersistedSurveys(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(SURVEY.LS_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Fail silently
  }
}

// One-time cleanup: WildApricot credentials used to be cached in localStorage
// (XSS-stealable, survived logout). They now live server-side only (wa_settings)
// — purge any leftovers from browsers that stored them.
export function purgeLegacyWaCreds(): void {
  try {
    localStorage.removeItem('iffs_wa_api_key');
    localStorage.removeItem('iffs_wa_account_id');
  } catch {
    // Fail silently
  }
}

// ─── Mapbox Token ────────────────────────────────────────

export function getMapboxToken(): string | null {
  try {
    return localStorage.getItem(SURVEY.LS_MAPBOX_TOKEN);
  } catch {
    return null;
  }
}

export function saveMapboxToken(token: string): void {
  try {
    localStorage.setItem(SURVEY.LS_MAPBOX_TOKEN, token);
  } catch {
    // Fail silently
  }
}
