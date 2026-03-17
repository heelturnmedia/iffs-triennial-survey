import type { SurveyProgress, WACredentials } from '../types';
import { SURVEY } from '../constants';

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

// ─── WildApricot Credentials ─────────────────────────────

export function getWaCreds(): WACredentials | null {
  try {
    const api_key = localStorage.getItem(SURVEY.LS_WA_KEY);
    const account_id = localStorage.getItem(SURVEY.LS_WA_ACCOUNT_ID);
    if (!api_key || !account_id) return null;
    return { api_key, account_id };
  } catch {
    return null;
  }
}

export function saveWaCreds(creds: WACredentials): void {
  try {
    localStorage.setItem(SURVEY.LS_WA_KEY, creds.api_key);
    localStorage.setItem(SURVEY.LS_WA_ACCOUNT_ID, creds.account_id);
  } catch {
    // Fail silently
  }
}

export function clearWaCreds(): void {
  try {
    localStorage.removeItem(SURVEY.LS_WA_KEY);
    localStorage.removeItem(SURVEY.LS_WA_ACCOUNT_ID);
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
