// ─────────────────────────────────────────────────────────────────────────────
// IFFS 2026 Triennial Survey — shared TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

import type { User } from '@supabase/supabase-js'

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'supervisor' | 'iffs-member' | 'user'
export type SurveyStatus = 'draft' | 'submitted' | 'reviewed'

export type AuthUser = User

export interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  country?: string
  institution?: string
  wa_member_id?: string
  wa_verified?: boolean
  created_at: string
  updated_at: string
}

// ─── Survey ──────────────────────────────────────────────────────────────────

export interface SurveyProgress {
  status: SurveyStatus
  page_no: number
  data: Record<string, unknown>
  saved_at: string
}

export interface SurveySubmission {
  id?: string
  user_id: string
  status: SurveyStatus
  page_no: number
  data: Record<string, unknown>
  saved_at: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  created_at?: string
  updated_at?: string
}

// Row returned by admin queries (joined with profiles)
export interface SubmissionRow extends SurveySubmission {
  profile?: Profile
  // Convenience fields joined from profiles
  first_name?: string
  last_name?: string
  email?: string
  country?: string
  institution?: string
}

export interface SurveyDefinition {
  id: string
  name: string
  definition: Record<string, unknown>
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export type ToastType = 'ok' | 'err' | 'info'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

export type ActivePanel =
  | 'overview'
  | 'reports'
  | 'users'
  | 'survey-mgmt'
  | 'wa-settings'
  | 'app-flow'

export interface ConfirmModalConfig {
  title: string
  message: string
  onConfirm: () => void | Promise<void>
  variant?: 'danger' | 'warning'
}

// ─── WildApricot ─────────────────────────────────────────────────────────────

export interface WACredentials {
  api_key: string
  account_id: string
}

export interface WAMemberCheckResult {
  isMember: boolean
  memberId?: string
  membershipLevel?: string
  error?: string
}

// ─── Survey sections meta ────────────────────────────────────────────────────

export interface SurveyPageMeta {
  name: string
  description: string
}
