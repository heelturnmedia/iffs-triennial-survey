import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserRole, WAStatus } from '@/types'

// WildApricot credentials live SERVER-SIDE ONLY (wa_settings table, written by
// the wa-sync Edge Function after a successful connection test). They were
// previously also cached in localStorage — XSS-stealable and persistent across
// logouts — which this hook no longer does.

export function useWildApricot() {
  const [isChecking, setIsChecking] = useState(false)

  /**
   * Read connection status from wa_settings (admin-only via RLS).
   * The api_key itself is never fetched to the browser.
   */
  const getStatus = async (): Promise<WAStatus> => {
    const { data, error } = await supabase
      .from('wa_settings')
      .select('account_id, sync_enabled, last_sync_at')
      .maybeSingle()
    if (error || !data) return { configured: false, accountId: null, lastSyncAt: null }
    return {
      configured: Boolean(data.sync_enabled && data.account_id),
      accountId: (data.account_id as string) || null,
      lastSyncAt: (data.last_sync_at as string) || null,
    }
  }

  /**
   * Check if an email is an active WildApricot member.
   * Returns 'iffs-member' if Active, 'user' otherwise (including on error —
   * wa-sync requires an admin JWT, so for anonymous sign-ups this resolves
   * to 'user' and membership is granted later via the admin's full sync).
   */
  const checkMembership = async (email: string): Promise<UserRole> => {
    setIsChecking(true)
    try {
      const { data, error } = await supabase.functions.invoke('wa-sync', {
        body: { email, testOnly: false, checkEmail: true },
      })
      if (error) throw error
      return data?.role === 'iffs-member' ? 'iffs-member' : 'user'
    } catch (err) {
      if (import.meta.env.DEV) console.warn('WA membership check failed:', err)
      return 'user'
    } finally {
      setIsChecking(false)
    }
  }

  /**
   * Test connection; the Edge Function persists the credentials to
   * wa_settings on success. Nothing is stored in the browser.
   * Returns { success, accountName? }
   */
  const saveCredentials = async (
    apiKey: string,
    accountId: string
  ): Promise<{ success: boolean; accountName?: string; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('wa-sync', {
        body: { apiKey, accountId, testOnly: true },
      })
      if (error) throw new Error(error.message)
      if (data?.success) {
        return { success: true, accountName: data.accountName }
      }
      return { success: false, error: data?.error ?? 'Connection test failed' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * Remove the stored credentials server-side and disable sync.
   */
  const clearCredentials = async (): Promise<boolean> => {
    const { data } = await supabase.from('wa_settings').select('id').maybeSingle()
    if (!data?.id) return true
    const { error } = await supabase
      .from('wa_settings')
      .update({ api_key: '', account_id: '', sync_enabled: false })
      .eq('id', data.id)
    return !error
  }

  /**
   * Trigger a full WA member sync (admin only).
   */
  const runFullSync = async (): Promise<{ success: boolean; synced?: number; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('wa-sync', {
        body: { fullSync: true },
      })
      if (error) throw new Error(error.message)
      return { success: true, synced: data?.synced ?? 0 }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  return { checkMembership, saveCredentials, clearCredentials, runFullSync, getStatus, isChecking }
}
