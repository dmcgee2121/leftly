import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getLeftlySupabaseClient } from '../lib/supabaseClient'
import type { LeftlyCloudConfig } from '../lib/cloudConfig'
import type { LeftlyBackupSummary } from '../lib/storage'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
}

type CloudNoticeTone = 'info' | 'success' | 'warning' | 'danger'

type CloudBackupSectionProps = {
  cloudConfig: LeftlyCloudConfig
  backupSummary: LeftlyBackupSummary
}

export function CloudBackupSection({ cloudConfig, backupSummary }: CloudBackupSectionProps) {
  if (!cloudConfig.enabled) {
    return null
  }

  if (cloudConfig.mode === 'missing-config') {
    return (
      <div className="leftly-shell-soft grid gap-3 border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">Cloud backup</p>
          <Badge muted>Unavailable</Badge>
        </div>
        <p className="text-sm leading-6 text-slate-300">
          The cloud feature flag is on, but the Supabase URL or publishable key is missing. Leftly stays fully local
          until those values are configured.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Cloud backup is optional. JSON backup, CSV export, and local reset still work exactly as before.
        </p>
      </div>
    )
  }

  return <CloudBackupShell backupSummary={backupSummary} />
}

function CloudBackupShell({ backupSummary }: { backupSummary: LeftlyBackupSummary }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [email, setEmail] = useState('')
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [cloudNotice, setCloudNotice] = useState('')
  const [cloudNoticeTone, setCloudNoticeTone] = useState<CloudNoticeTone>('info')
  const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false)
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)

  const supabase = getLeftlySupabaseClient()
  const signedInUserEmail = session?.user.email ?? session?.user.phone ?? ''

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return
        }

        if (error) {
          setAuthError(error.message)
          setSession(null)
        } else {
          setSession(data.session)
          setAuthError('')
        }

        setAuthLoading(false)
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return
        }

        setAuthError(error instanceof Error ? error.message : 'Unable to load cloud session.')
        setSession(null)
        setAuthLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return
      }

      setSession(nextSession)
      setAuthError('')
      setAuthNotice('')
      setAuthLoading(false)
    })

    subscription = data.subscription

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [supabase])

  if (!supabase) {
    return (
      <div className="leftly-shell-soft grid gap-3 border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">Cloud backup</p>
          <Badge muted>Unavailable</Badge>
        </div>
        <p className="text-sm leading-6 text-slate-300">
          Supabase is not configured, so cloud auth and backup remain hidden behind the feature flag without breaking
          local-first budgeting.
        </p>
      </div>
    )
  }

  async function handleSendSignInLink() {
    if (!supabase) {
      setAuthError('Cloud auth is not available because Supabase is not configured.')
      return
    }

    const nextEmail = email.trim()
    if (!nextEmail || !nextEmail.includes('@')) {
      setAuthError('Enter a valid email address to continue.')
      return
    }

    setIsSendingLink(true)
    setAuthError('')
    setAuthNotice('')

    const redirectTo = window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      setAuthError(error.message)
    } else {
      setAuthNotice(`Sign-in link sent to ${nextEmail}. Check email to finish sign-in.`)
      setEmail('')
    }

    setIsSendingLink(false)
  }

  async function handleSignOut() {
    if (!supabase) {
      setAuthError('Cloud auth is not available because Supabase is not configured.')
      return
    }

    setIsSigningOut(true)
    setAuthError('')

    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
    } else {
      setAuthNotice('Signed out of cloud backup.')
    }

    setIsSigningOut(false)
  }

  function openCloudUploadFlow() {
    setIsUploadConfirmOpen(true)
    setIsRestoreConfirmOpen(false)
    setCloudNotice('')
    setCloudNoticeTone('info')
  }

  function openCloudRestoreFlow() {
    setIsRestoreConfirmOpen(true)
    setIsUploadConfirmOpen(false)
    setCloudNotice('')
    setCloudNoticeTone('info')
  }

  function confirmUploadFlow() {
    setIsUploadConfirmOpen(false)
    setCloudNotice('Cloud upload is scaffolded but not wired to backend tables yet. This step is ready for the next issue.')
    setCloudNoticeTone('warning')
  }

  function confirmRestoreFlow() {
    setIsRestoreConfirmOpen(false)
    setCloudNotice(
      'Cloud restore is scaffolded but not wired to backend tables yet. The confirmation flow is in place for the next backend milestone.',
    )
    setCloudNoticeTone('warning')
  }

  const lastCloudBackup = null as { exportedAt: string } | null

  return (
    <div className="leftly-shell-soft grid gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">Cloud backup</p>
        <Badge muted>Optional</Badge>
        <Badge muted>Beta</Badge>
      </div>

      <p className="text-sm leading-6 text-slate-300">
        Leftly still works locally without an account. Cloud backup is an optional shell for future restore flows, not
        live sync. No bank connection is required.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Local bills" value={`${backupSummary.billCount}`} />
        <Stat label="Local expenses" value={`${backupSummary.expenseCount}`} />
        <Stat label="Bill Plan items" value={`${backupSummary.recurringTemplateCount}`} />
        <Stat label="History snapshots" value={`${backupSummary.historySnapshotCount}`} />
      </div>

      <div className="leftly-shell-faint grid gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Account</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Magic-link sign-in keeps the account shell simple.</p>
          </div>
          {authLoading ? <Badge muted>Loading</Badge> : session ? <Badge success>Signed in</Badge> : <Badge muted>Signed out</Badge>}
        </div>

        {authError ? <CloudMessage tone="danger">{authError}</CloudMessage> : null}
        {authNotice ? <CloudMessage tone="success">{authNotice}</CloudMessage> : null}

        {authLoading ? (
          <p className="text-sm leading-6 text-slate-400">Checking the cloud session...</p>
        ) : session ? (
          <div className="grid gap-3">
            <div className="leftly-shell-soft grid gap-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
              <p className="text-sm font-semibold text-white">{signedInUserEmail || 'Cloud user'}</p>
              <p className="text-sm leading-6 text-slate-400">
                Signed-in status is real, but cloud backup upload and restore remain placeholders until the backend
                tables are added.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={openCloudUploadFlow} className={`${buttonStyles.primary} w-full`}>
                Upload current snapshot
              </button>
              <button type="button" onClick={handleSignOut} className={`${buttonStyles.secondary} w-full`} disabled={isSigningOut}>
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="leftly-shell-soft grid gap-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Signed out</p>
              <p className="text-sm leading-6 text-slate-400">
                Leftly stays local-first by default. Sign in only if you want to prepare for cloud backup later.
              </p>
            </div>

            <label className="leftly-field">
              <span>Email</span>
              <span className="leftly-input-shell">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={handleSendSignInLink} className={`${buttonStyles.primary} w-full`} disabled={isSendingLink}>
                {isSendingLink ? 'Sending link...' : 'Send sign-in link'}
              </button>
              <button type="button" onClick={() => setEmail('')} className={`${buttonStyles.secondary} w-full`}>
                Clear email
              </button>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              This uses a magic-link flow. Leftly does not need your password, and local budgeting still works if cloud
              sign-in is unavailable.
            </p>
          </div>
        )}
      </div>

      <div className="leftly-shell-soft grid gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Cloud backup status</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              The backend tables are not wired yet, so this section is a safe shell for the next implementation issue.
            </p>
          </div>
          <Badge muted>Preview only</Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Last cloud backup</p>
            <p className="leftly-data-stat-value">{lastCloudBackup ? lastCloudBackup.exportedAt : 'None yet'}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Cloud restore</p>
            <p className="leftly-data-stat-value">{session ? 'Ready for backend tables' : 'Sign in first'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={openCloudRestoreFlow} className={`${buttonStyles.secondary} w-full`} disabled={!session}>
            Restore from cloud
          </button>
          <button type="button" onClick={openCloudUploadFlow} className={`${buttonStyles.secondary} w-full`} disabled={!session}>
            Upload snapshot shell
          </button>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Upload and restore are placeholders until the next backend issue adds tables and storage paths. They do not
          write cloud data yet.
        </p>
      </div>

      {cloudNotice ? <CloudMessage tone={cloudNoticeTone}>{cloudNotice}</CloudMessage> : null}

      {isUploadConfirmOpen ? (
        <ConfirmSheet
          title="Upload snapshot shell"
          description="This confirms the intended upload flow, but no cloud write happens yet because backend tables are not wired."
          confirmLabel="Confirm upload shell"
          onConfirm={confirmUploadFlow}
          onCancel={() => setIsUploadConfirmOpen(false)}
        />
      ) : null}

      {isRestoreConfirmOpen ? (
        <ConfirmSheet
          title="Restore from cloud shell"
          description="This confirms the intended restore flow, but no cloud restore happens yet because backend tables are not wired."
          confirmLabel="Confirm restore shell"
          onConfirm={confirmRestoreFlow}
          onCancel={() => setIsRestoreConfirmOpen(false)}
        />
      ) : null}
    </div>
  )
}

function ConfirmSheet({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-[1.2rem] border border-amber-500/20 bg-amber-500/10 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onConfirm} className={`${buttonStyles.primary} w-full`}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={`${buttonStyles.secondary} w-full`}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function CloudMessage({ tone, children }: { tone: CloudNoticeTone; children: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50'
      : tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-50'
        : tone === 'danger'
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-50'
          : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50'

  return <p className={`rounded-[1rem] border px-3 py-3 text-sm leading-6 ${toneClass}`}>{children}</p>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="leftly-data-stat">
      <p className="leftly-data-stat-label">{label}</p>
      <p className="leftly-data-stat-value">{value}</p>
    </div>
  )
}

function Badge({
  children,
  muted = false,
  success = false,
}: {
  children: ReactNode
  muted?: boolean
  success?: boolean
}) {
  const className = success ? 'leftly-chip-success' : muted ? 'leftly-chip-muted' : 'leftly-chip-default'
  return <span className={`leftly-chip ${className}`}>{children}</span>
}
