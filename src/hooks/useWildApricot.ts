import { useState } from 'react'
import { getWaCreds, saveWaCreds, clearWaCreds } from '@/lib/localStorage'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

export function useWildApricot() {
  const [isChecking, setIsChecking] = useState(false)

  const isConfigured = (): boolean => {
    const creds = getWaCreds()
    return Boolean(creds?.api_key && creds?.account_id)
  }

  /**
   * Check if an email is an active WildApricot member.
   * Returns 'iffs-member' if Active, 'user' otherwise (including on error).
   */
  const checkMembership = async (email: string): Promise<UserRole> => {
    if (!isConfigured()) return 'user'
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
   * Test connection + save credentials if successful.
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
        saveWaCreds({ api_key: apiKey, account_id: accountId })
        return { success: true, accountName: data.accountName }
      }
      return { success: false, error: 'Connection test failed' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  const clearCredentials = () => clearWaCreds()

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

  return { checkMembership, saveCredentials, clearCredentials, runFullSync, isConfigured, isChecking }
}
