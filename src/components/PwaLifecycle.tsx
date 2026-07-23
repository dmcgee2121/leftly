import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaLifecycle({ isBlockingInteraction }: { isBlockingInteraction: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Leftly service worker registration failed.', error)
    },
  })
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [offlineReadyDismissed, setOfflineReadyDismissed] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const reloadStartedRef = useRef(false)

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

  async function acceptUpdate() {
    if (isUpdating || reloadStartedRef.current) {
      return
    }

    reloadStartedRef.current = true
    setIsUpdating(true)
    await updateServiceWorker(true)
  }

  const showOfflineReady = offlineReady && !offlineReadyDismissed
  const showUpdatePrompt = needRefresh && !updateDismissed && !isBlockingInteraction

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
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto flex max-w-xl items-start justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-slate-950/95 px-4 py-3 text-sm leading-6 text-emerald-100 shadow-lg shadow-slate-950/30 backdrop-blur md:bottom-4"
        >
          <p>Leftly is ready to use offline on this device.</p>
          <button type="button" onClick={() => setOfflineReadyDismissed(true)} className="button-secondary shrink-0 px-3 py-2 text-xs">
            Dismiss
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
              onClick={() => {
                setUpdateDismissed(true)
                setNeedRefresh(false)
              }}
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
