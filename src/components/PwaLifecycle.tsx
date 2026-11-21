import { useEffect, useRef, useState } from 'react'
import type { PwaLifecycleState } from './usePwaLifecycle'
import { isNativePlatform } from '../lib/native'

// The "ready offline" note is shown once per device, then hides itself.
const OFFLINE_READY_SEEN_KEY = 'leftly.offlineReadyNoticeSeen'
const OFFLINE_READY_AUTO_HIDE_MS = 6000

function hasSeenOfflineReadyNotice() {
  try {
    return window.localStorage.getItem(OFFLINE_READY_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markOfflineReadyNoticeSeen() {
  try {
    window.localStorage.setItem(OFFLINE_READY_SEEN_KEY, '1')
  } catch {
    // Storage can be unavailable (private mode); the note simply shows again next time.
  }
}

export function PwaLifecycle({ isBlockingInteraction, pwa }: { isBlockingInteraction: boolean; pwa: PwaLifecycleState }) {
  const {
    offlineCapabilityStatus,
    needRefresh,
    isUpdating,
    dismissUpdate,
    acceptUpdate,
  } = pwa
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [readyMessageDismissed, setReadyMessageDismissed] = useState(() => isNativePlatform() || hasSeenOfflineReadyNotice())
  const previousCapabilityStatus = useRef(offlineCapabilityStatus)

  useEffect(() => {
    if (offlineCapabilityStatus === 'ready' && previousCapabilityStatus.current !== 'ready' && !isNativePlatform() && !hasSeenOfflineReadyNotice()) {
      setReadyMessageDismissed(false)
    }
    previousCapabilityStatus.current = offlineCapabilityStatus
  }, [offlineCapabilityStatus])

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }

    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const showOfflineReady = offlineCapabilityStatus === 'ready' && !readyMessageDismissed

  useEffect(() => {
    if (!showOfflineReady) return
    markOfflineReadyNoticeSeen()
    const timer = window.setTimeout(() => setReadyMessageDismissed(true), OFFLINE_READY_AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [showOfflineReady])
  const showUpdatePrompt = needRefresh && !isBlockingInteraction

  return (
    <>
      {isOffline ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 mx-auto max-w-xl rounded-2xl border border-amber-400/25 bg-slate-950/95 px-4 py-3 text-sm leading-6 text-amber-100 shadow-lg shadow-slate-950/30 backdrop-blur"
        >
          <p className="font-semibold">You&apos;re offline</p>
          <p className="text-amber-100/80">Leftly is using data saved on this device. Cloud backup and authentication need a connection.</p>
        </div>
      ) : null}

      {showOfflineReady && !showUpdatePrompt ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-slate-950/95 py-1 pl-4 pr-1 text-sm leading-6 text-emerald-100 shadow-lg shadow-slate-950/30 backdrop-blur"
        >
          <p>Works offline on this device.</p>
          <button type="button" onClick={() => setReadyMessageDismissed(true)} className="leftly-text-action shrink-0">
            OK
          </button>
        </div>
      ) : null}

      {showUpdatePrompt ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto max-w-xl rounded-2xl border border-cyan-400/25 bg-slate-950/95 p-4 text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur md:bottom-4"
        >
          <p className="text-sm font-semibold text-white">New Leftly version available</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">A newer version of Leftly is ready. Update when you are finished with your current entry.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={dismissUpdate}
              disabled={isUpdating}
              className="button-secondary w-full sm:w-auto"
            >
              Later
            </button>
            <button type="button" onClick={acceptUpdate} disabled={isUpdating} className="button-primary w-full sm:w-auto">
              {isUpdating ? 'Updating…' : 'Update now'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
