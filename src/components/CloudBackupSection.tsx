import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getLeftlyCloudConfig } from '../lib/cloudConfig'
import { fetchLatestCloudBackup, uploadCurrentLocalBackup, type CloudBackupSnapshot } from '../lib/cloudBackups'
import { getLeftlySupabaseClient } from '../lib/supabaseClient'
import { saveLeftlyBackup, type LeftlyBackupSummary } from '../lib/storage'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
}

type CloudNoticeTone = 'info' | 'success' | 'warning' | 'danger'

type CloudBackupSectionProps = {
  cloudConfig: ReturnType<typeof getLeftlyCloudConfig>
  backupSummary: LeftlyBackupSummary
  onLocalDataReloaded: () => void
}

export function CloudBackupSection({ cloudConfig, backupSummary, onLocalDataReloaded }: CloudBackupSectionProps) {
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
          JSON backup, CSV export, and local reset still work exactly as before.
        </p>
      </div>
    )
  }

  return <CloudBackupShell backupSummary={backupSummary} onLocalDataReloaded={onLocalDataReloaded} />
}

function CloudBackupShell({
  backupSummary,
  onLocalDataReloaded,
}: {
  backupSummary: LeftlyBackupSummary
  onLocalDataReloaded: () => void
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [email, setEmail] = useState('')
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [cloudNotice, setCloudNotice] = useState('')
  const [cloudNoticeTone, setCloudNoticeTone] = useState<CloudNoticeTone>('info')
  const [isLoadingCloudBackup, setIsLoadingCloudBackup] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false)
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  const [latestCloudBackup, setLatestCloudBackup] = useState<CloudBackupSnapshot | null>(null)

  const supabase = getLeftlySupabaseClient()
  const signedInUserEmail = session?.user.email ?? session?.user.phone ?? ''

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let mounted = true

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
      if (!nextSession) {
        setLatestCloudBackup(null)
      }
      setAuthError('')
      setAuthNotice('')
      setCloudError('')
      setCloudNotice('')
      setCloudNoticeTone('info')
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (!session) {
      return
    }

    let mounted = true

    fetchLatestCloudBackup()
      .then((snapshot) => {
        if (!mounted) {
          return
        }

        setLatestCloudBackup(snapshot)
        setCloudError('')
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return
        }

        setCloudError(error instanceof Error ? error.message : 'Unable to load the saved cloud snapshot.')
        setLatestCloudBackup(null)
      })

    return () => {
      mounted = false
    }
  }, [session])

  if (!supabase) {
    return (
      <div className="leftly-shell-soft grid gap-3 border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">Cloud backup</p>
          <Badge muted>Unavailable</Badge>
        </div>
        <p className="text-sm leading-6 text-slate-300">
          Supabase is not configured, so cloud backup remains hidden behind the feature flag without changing the
          local-first app.
        </p>
      </div>
    )
  }

  async function handleSendSignInLink() {
    if (!supabase) {
      setAuthError('Cloud backup is unavailable because Supabase is not configured.')
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
      setAuthNotice(`Sign-in link sent to ${nextEmail}.`)
      setEmail('')
    }

    setIsSendingLink(false)
  }

  async function handleSignOut() {
    if (!supabase) {
      setAuthError('Cloud backup is unavailable because Supabase is not configured.')
      return
    }

    setIsSigningOut(true)
    setAuthError('')

    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
    } else {
      setAuthNotice('Signed out of cloud backup.')
      setLatestCloudBackup(null)
    }

    setIsSigningOut(false)
  }

  function openUploadConfirm() {
    setIsUploadConfirmOpen(true)
    setIsRestoreConfirmOpen(false)
    setCloudError('')
    setCloudNotice('')
    setCloudNoticeTone('info')
  }

  function openRestoreConfirm() {
    setIsRestoreConfirmOpen(true)
    setIsUploadConfirmOpen(false)
    setCloudError('')
    setCloudNotice('')
    setCloudNoticeTone('info')
  }

  async function refreshLatestCloudBackup() {
    setIsLoadingCloudBackup(true)
    try {
      const snapshot = await fetchLatestCloudBackup()
      setLatestCloudBackup(snapshot)
      return snapshot
    } finally {
      setIsLoadingCloudBackup(false)
    }
  }

  async function confirmUploadFlow() {
    setIsUploadConfirmOpen(false)
    setCloudError('')
    setCloudNotice('')
    setIsUploading(true)

    try {
      const result = await uploadCurrentLocalBackup()
      setLatestCloudBackup(result)
      setCloudNotice('Current device snapshot uploaded to cloud backup.')
      setCloudNoticeTone('success')
      await refreshLatestCloudBackup()
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Unable to upload the cloud snapshot.')
      setCloudNoticeTone('danger')
    } finally {
      setIsUploading(false)
    }
  }

  async function confirmRestoreFlow() {
    setIsRestoreConfirmOpen(false)
    setCloudError('')
    setCloudNotice('')
    setIsRestoring(true)

    try {
      const snapshot = latestCloudBackup ?? (await refreshLatestCloudBackup())
      if (!snapshot) {
        setCloudError('No cloud snapshot has been saved yet.')
        return
      }

      saveLeftlyBackup(snapshot.backup)
      onLocalDataReloaded()
      setCloudNotice('Cloud snapshot restored to this device.')
      setCloudNoticeTone('success')
      await refreshLatestCloudBackup()
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Unable to restore the cloud snapshot.')
      setCloudNoticeTone('danger')
    } finally {
      setIsRestoring(false)
    }
  }

  const cloudBackupDate = latestCloudBackup ? formatCloudDate(latestCloudBackup.row.updated_at) : 'No cloud snapshot yet'
  const cloudBackupSummary = latestCloudBackup?.summary ?? null
  const hasCloudBackup = Boolean(latestCloudBackup)
  const cloudBackupState = latestCloudBackup
    ? 'Ready to restore'
    : session
      ? 'No cloud snapshot yet'
      : 'Sign in to manage cloud snapshots'
  const cloudRestoreSummary = cloudBackupSummary ? formatCloudBackupSummary(cloudBackupSummary) : ''

  return (
    <div className="leftly-shell-soft grid gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">Cloud backup</p>
        <Badge muted>Optional</Badge>
        <Badge muted>Latest snapshot</Badge>
      </div>

      <p className="text-sm leading-6 text-slate-300">
        Cloud backup is optional and stores a single latest snapshot for your account. It is not live sync, Leftly
        still works locally without cloud sync, and no bank connection is required.
      </p>
      <p className="text-sm leading-6 text-slate-300">
        Upload saves one cloud snapshot. Restore replaces the local data on this device, but it does not delete the
        cloud copy. Export JSON first if you want the safest portable recovery file before a restore, reset, or demo
        test.
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
            <p className="mt-1 text-sm leading-6 text-slate-400">Magic-link sign-in keeps the cloud path simple.</p>
          </div>
          {authLoading ? (
            <Badge muted>Loading</Badge>
          ) : session ? (
            <Badge success>Signed in</Badge>
          ) : (
            <Badge muted>Signed out</Badge>
          )}
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
                Cloud backup uses your signed-in account only. It does not change budgeting data until you choose
                upload or restore.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={openUploadConfirm} className={`${buttonStyles.primary} w-full`}>
                {isUploading ? 'Uploading...' : 'Upload current snapshot'}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className={`${buttonStyles.secondary} w-full`}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="leftly-shell-soft grid gap-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Signed out</p>
              <p className="text-sm leading-6 text-slate-400">
                Leftly stays local-first by default. Sign in only if you want cloud backup later.
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
              <button
                type="button"
                onClick={handleSendSignInLink}
                className={`${buttonStyles.primary} w-full`}
                disabled={isSendingLink}
              >
                {isSendingLink ? 'Sending link...' : 'Send sign-in link'}
              </button>
              <button type="button" onClick={() => setEmail('')} className={`${buttonStyles.secondary} w-full`}>
                Clear email
              </button>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              This uses a magic-link flow. Leftly does not need your password.
            </p>
          </div>
        )}
      </div>

      <div className="leftly-shell-soft grid gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Cloud snapshot</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              One latest row per account keeps the cloud path simple and avoids live-sync conflicts.
            </p>
          </div>
          <Badge muted>{isLoadingCloudBackup ? 'Loading' : cloudBackupState}</Badge>
        </div>

        {cloudError ? <CloudMessage tone="danger">{cloudError}</CloudMessage> : null}
        {cloudNotice ? <CloudMessage tone={cloudNoticeTone}>{cloudNotice}</CloudMessage> : null}

        {session && !hasCloudBackup ? (
          <div className="leftly-shell-faint grid gap-2 p-3">
            <p className="text-sm font-medium text-white">No cloud snapshot yet</p>
            <p className="text-sm leading-6 text-slate-400">
              Upload current snapshot to create the first cloud backup. Restore stays disabled until one exists. Keep
              using JSON backup if you want a portable safety copy before testing restore or reset.
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Last cloud backup</p>
            <p className="leftly-data-stat-value">{cloudBackupDate}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Restore status</p>
            <p className="leftly-data-stat-value">
              {session ? (hasCloudBackup ? 'Ready after confirmation' : 'Waiting for first upload') : 'Sign in first'}
            </p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Cloud backups</p>
            <p className="leftly-data-stat-value">{hasCloudBackup ? '1 latest snapshot' : 'None saved yet'}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Portable recovery</p>
            <p className="leftly-data-stat-value">Export JSON first</p>
          </div>
        </div>

        {cloudBackupSummary ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Stat label="Cloud bills" value={`${cloudBackupSummary.billCount}`} />
            <Stat label="Cloud expenses" value={`${cloudBackupSummary.expenseCount}`} />
            <Stat label="Cloud history" value={`${cloudBackupSummary.historySnapshotCount}`} />
            <Stat label="Cloud categories" value={`${cloudBackupSummary.categoryCount}`} />
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={openRestoreConfirm}
            className={`${buttonStyles.secondary} w-full`}
            disabled={!session || isLoadingCloudBackup || isRestoring || !hasCloudBackup}
          >
            {isRestoring ? 'Restoring...' : 'Restore latest snapshot'}
          </button>
          <button
            type="button"
            onClick={openUploadConfirm}
            className={`${buttonStyles.secondary} w-full`}
            disabled={!session || isLoadingCloudBackup || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload current snapshot'}
          </button>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Cloud backup remains optional. JSON backup/export/import still works and remains the safest portable restore
          path.
        </p>
      </div>

      {isUploadConfirmOpen ? (
        <ConfirmSheet
          title="Upload current snapshot"
          description="This saves one latest backup row for your signed-in account. It does not change any local data."
          confirmLabel={isUploading ? 'Uploading...' : 'Confirm upload'}
          onConfirm={confirmUploadFlow}
          onCancel={() => setIsUploadConfirmOpen(false)}
        />
      ) : null}

      {isRestoreConfirmOpen ? (
        <ConfirmSheet
          title="Restore latest snapshot"
          description={
            latestCloudBackup
              ? `This replaces the local data on this device with the cloud snapshot saved on ${cloudBackupDate}.`
              : 'No cloud snapshot is loaded yet. Upload one before restoring.'
          }
          secondaryDescription={
            latestCloudBackup
              ? `The cloud copy stays in Supabase. ${cloudRestoreSummary ? `Snapshot contents: ${cloudRestoreSummary}. ` : ''}Export JSON first if you want a portable safety copy before overwriting this device.`
              : 'Restore stays disabled until a snapshot exists.'
          }
          confirmLabel={isRestoring ? 'Restoring...' : 'Confirm restore'}
          onConfirm={confirmRestoreFlow}
          onCancel={() => setIsRestoreConfirmOpen(false)}
        />
      ) : null}
    </div>
  )
}

function formatCloudDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatCloudBackupSummary(summary: LeftlyBackupSummary) {
  const parts = [
    `${summary.billCount} bill${summary.billCount === 1 ? '' : 's'}`,
    `${summary.expenseCount} expense${summary.expenseCount === 1 ? '' : 's'}`,
    `${summary.historySnapshotCount} history snapshot${summary.historySnapshotCount === 1 ? '' : 's'}`,
    `${summary.categoryCount} categor${summary.categoryCount === 1 ? 'y' : 'ies'}`,
  ]

  return parts.join(', ')
}

function ConfirmSheet({
  title,
  description,
  secondaryDescription,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  secondaryDescription?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-[1.2rem] border border-amber-500/20 bg-amber-500/10 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      {secondaryDescription ? <p className="mt-2 text-sm leading-6 text-slate-400">{secondaryDescription}</p> : null}
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
