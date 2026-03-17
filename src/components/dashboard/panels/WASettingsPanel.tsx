import { useState, useEffect } from 'react'
import { useWildApricot } from '@/hooks/useWildApricot'
import { useUIStore } from '@/stores/uiStore'
import { getWaCreds } from '@/lib/localStorage'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-body text-[11px] font-semibold px-2.5 py-1 rounded-full border tracking-[0.04em]',
        ok
          ? 'bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4]'
          : 'bg-amber-50 text-amber-700 border-amber-200',
      ].join(' ')}
    >
      <span
        className={[
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          ok ? 'bg-[#1d7733]' : 'bg-amber-400',
        ].join(' ')}
      />
      {ok ? 'Connected' : 'Not configured'}
    </span>
  )
}

// ─── Credentials form ─────────────────────────────────────────────────────────

interface CredFormProps {
  onSaved: (accountName: string) => void
}

function CredentialsForm({ onSaved }: CredFormProps) {
  const { saveCredentials } = useWildApricot()
  const { toast } = useUIStore()
  const [apiKey, setApiKey] = useState('')
  const [accountId, setAccountId] = useState('')
  const [testing, setTesting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim() || !accountId.trim()) return
    setTesting(true)
    try {
      const result = await saveCredentials(apiKey.trim(), accountId.trim())
      if (result.success) {
        toast(`Connected to WildApricot: ${result.accountName ?? 'OK'}`, 'ok')
        onSaved(result.accountName ?? '')
        setApiKey('')
        setAccountId('')
      } else {
        toast(result.error ?? 'Connection test failed', 'err')
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="wa-api-key"
          className="block font-body text-[12px] font-semibold text-[#3d4a52] mb-1.5"
        >
          API Key
        </label>
        <input
          id="wa-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter WildApricot API key"
          autoComplete="new-password"
          className="w-full font-body text-[13px] px-4 py-2.5 rounded-lg border outline-none transition-all bg-white"
          style={{ borderColor: 'var(--bd)', color: 'var(--f1)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--g1)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bd)')}
          required
        />
      </div>

      <div>
        <label
          htmlFor="wa-account-id"
          className="block font-body text-[12px] font-semibold text-[#3d4a52] mb-1.5"
        >
          Account ID
        </label>
        <input
          id="wa-account-id"
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="123456"
          className="w-full font-body text-[13px] px-4 py-2.5 rounded-lg border outline-none transition-all bg-white"
          style={{ borderColor: 'var(--bd)', color: 'var(--f1)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--g1)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bd)')}
          required
        />
        <p className="font-body text-[11px] text-[#7a8a96] mt-1">
          Find your Account ID in WildApricot admin portal under Account settings.
        </p>
      </div>

      <button
        type="submit"
        disabled={testing || !apiKey.trim() || !accountId.trim()}
        className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-5 py-2.5 rounded-full text-white transition-all disabled:opacity-50"
        style={{ background: 'var(--g1)', boxShadow: '0 4px 12px rgba(29,119,51,0.20)' }}
      >
        {testing && (
          <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
        )}
        {testing ? 'Testing...' : 'Test and Save Credentials'}
      </button>
    </form>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function WASettingsPanel() {
  const { clearCredentials, runFullSync, isConfigured } = useWildApricot()
  const { toast, openConfirmModal } = useUIStore()
  const [configured, setConfigured] = useState(false)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; at: string } | null>(null)

  useEffect(() => {
    setConfigured(isConfigured())
    try {
      const stored = localStorage.getItem('iffs_wa_account_name')
      if (stored) setAccountName(stored)
    } catch {
      // ignore
    }
  }, [isConfigured])

  const handleSaved = (name: string) => {
    setConfigured(true)
    setAccountName(name || null)
    if (name) {
      try {
        localStorage.setItem('iffs_wa_account_name', name)
      } catch {
        // ignore
      }
    }
  }

  const handleClear = () => {
    openConfirmModal({
      title: 'Clear WildApricot Credentials',
      message:
        'This will remove the stored API key and account ID from this browser. You can re-enter them at any time.',
      variant: 'warning',
      onConfirm: () => {
        clearCredentials()
        try {
          localStorage.removeItem('iffs_wa_account_name')
        } catch {
          // ignore
        }
        setConfigured(false)
        setAccountName(null)
        toast('WildApricot credentials cleared.', 'info')
      },
    })
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await runFullSync()
      if (result.success) {
        const at = new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        setSyncResult({ synced: result.synced ?? 0, at })
        toast(`Sync complete - ${result.synced ?? 0} members updated.`, 'ok')
      } else {
        toast(result.error ?? 'Sync failed', 'err')
      }
    } finally {
      setSyncing(false)
    }
  }

  const creds = getWaCreds()
  const maskedKey = creds?.api_key
    ? creds.api_key.slice(0, 6) + '...' + creds.api_key.slice(-4)
    : null

  return (
    <div className="p-6 md:p-8 max-w-[700px]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display text-[22px] font-bold text-[#0d1117] leading-snug">
            WildApricot Settings
          </h1>
          <p className="font-body text-[13px] text-[#7a8a96] mt-0.5">
            Connect your WildApricot account to verify IFFS membership on sign-up.
          </p>
        </div>
        <StatusDot ok={configured} />
      </div>

      {/* Connection status card */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
      >
        <h2 className="font-display text-[14px] font-bold text-[#0d1117] mb-4">
          Connection Status
        </h2>

        {configured ? (
          <div className="space-y-3">
            {accountName && (
              <div
                className="flex items-center justify-between py-2.5 border-b"
                style={{ borderColor: 'var(--bd)' }}
              >
                <span className="font-body text-[12px] text-[#7a8a96]">Account</span>
                <span className="font-body text-[13px] font-semibold text-[#0d1117]">
                  {accountName}
                </span>
              </div>
            )}

            {maskedKey && (
              <div
                className="flex items-center justify-between py-2.5 border-b"
                style={{ borderColor: 'var(--bd)' }}
              >
                <span className="font-body text-[12px] text-[#7a8a96]">API Key</span>
                <span className="font-mono text-[12px] text-[#3d4a52]">{maskedKey}</span>
              </div>
            )}

            {creds?.account_id && (
              <div className="flex items-center justify-between py-2.5">
                <span className="font-body text-[12px] text-[#7a8a96]">Account ID</span>
                <span className="font-mono text-[12px] text-[#3d4a52]">{creds.account_id}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-5 py-2.5 rounded-full text-white transition-all disabled:opacity-60"
                style={{ background: 'var(--g1)', boxShadow: '0 4px 12px rgba(29,119,51,0.20)' }}
              >
                {syncing && (
                  <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                )}
                {syncing ? 'Syncing...' : 'Run Full Member Sync'}
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2.5 rounded-full border transition-all"
                style={{ borderColor: 'var(--bd2)', color: 'var(--f3)' }}
              >
                Clear Credentials
              </button>
            </div>

            {syncResult && (
              <div
                className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg"
                style={{ background: 'var(--g3)', border: '1px solid var(--bd2)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 7l3 3 6-6"
                    stroke="#1d7733"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="font-body text-[12px] font-semibold text-[#0e5921]">
                  Last sync: {syncResult.synced} members updated at {syncResult.at}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="font-body text-[13px] text-[#7a8a96]">
            No credentials stored. Enter your WildApricot API key and account ID below to enable
            automatic membership verification.
          </p>
        )}
      </div>

      {/* Credentials form */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
      >
        <h2 className="font-display text-[14px] font-bold text-[#0d1117] mb-1">
          {configured ? 'Update Credentials' : 'Enter Credentials'}
        </h2>
        <p className="font-body text-[12px] text-[#7a8a96] mb-5">
          Credentials are stored locally in your browser and sent only to the Supabase Edge
          Function for verification. They are never stored in plain text on the server.
        </p>
        <CredentialsForm onSaved={handleSaved} />
      </div>

      {/* How it works */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--s2)', border: '1px solid var(--bd)' }}
      >
        <h3 className="font-display text-[13px] font-bold text-[#0d1117] mb-3">How it works</h3>
        <ol className="space-y-2">
          {[
            'New users sign up with their email address.',
            'On sign-up, the wa-sync Edge Function checks if the email belongs to an active WildApricot member.',
            "If the email matches, the user role is set to 'iffs-member' automatically.",
            'Admins can run a full sync to update all existing users from the WildApricot member list.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-display text-[10px] font-bold text-white mt-0.5"
                style={{ background: 'var(--g1)' }}
              >
                {i + 1}
              </span>
              <span className="font-body text-[12px] text-[#3d4a52] leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
