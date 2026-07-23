import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export type OfflineCapabilityStatus = 'unsupported' | 'preparing' | 'ready' | 'error'

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type PwaLifecycleState = {
  canInstall: boolean
  hasInstallPrompt: boolean
  isInstalled: boolean
  offlineCapabilityStatus: OfflineCapabilityStatus
  isRetryingOfflineSetup: boolean
  isUpdating: boolean
  needRefresh: boolean
  install: () => Promise<void>
  retryOfflineSetup: () => Promise<void>
  dismissUpdate: () => void
  acceptUpdate: () => Promise<void>
}

export function usePwaLifecycle(): PwaLifecycleState {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => detectInstalledMode())
  const [offlineCapabilityStatus, setOfflineCapabilityStatus] = useState<OfflineCapabilityStatus>(getInitialCapabilityStatus)
  const [isRetryingOfflineSetup, setIsRetryingOfflineSetup] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [reloadStarted, setReloadStarted] = useState(false)
  const observedRegistrations = useRef(new WeakSet<ServiceWorkerRegistration>())

  const confirmRegistration = useCallback(async (candidate: ServiceWorkerRegistration) => {
    try {
      const readyRegistration = await navigator.serviceWorker.ready
      if (readyRegistration.active?.state === 'activated' || candidate.active?.state === 'activated') {
        setOfflineCapabilityStatus('ready')
        return
      }

      console.warn('Leftly service worker is registered but not activated yet.', {
        scope: candidate.scope,
        active: candidate.active?.state,
        waiting: candidate.waiting?.state,
        installing: candidate.installing?.state,
        controller: Boolean(navigator.serviceWorker.controller),
      })
    } catch (error) {
      setOfflineCapabilityStatus('error')
      console.warn('Leftly could not confirm an active service worker.', {
        scope: candidate.scope,
        active: candidate.active?.state,
        waiting: candidate.waiting?.state,
        installing: candidate.installing?.state,
        error,
      })
    }
  }, [])

  const observeRegistration = useCallback((candidate: ServiceWorkerRegistration) => {
    if (observedRegistrations.current.has(candidate)) {
      return
    }

    observedRegistrations.current.add(candidate)
    const handleStateChange = () => {
      const worker = candidate.installing ?? candidate.waiting ?? candidate.active
      if (worker?.state === 'activated') {
        void confirmRegistration(candidate)
      } else if (worker?.state === 'redundant' && !candidate.active) {
        setOfflineCapabilityStatus('error')
      }
    }

    candidate.addEventListener('updatefound', () => {
      candidate.installing?.addEventListener('statechange', handleStateChange)
      handleStateChange()
    })
    candidate.installing?.addEventListener('statechange', handleStateChange)
    candidate.waiting?.addEventListener('statechange', handleStateChange)
    candidate.active?.addEventListener('statechange', handleStateChange)
    void confirmRegistration(candidate)
  }, [confirmRegistration])

  const handleRegisteredSW = useCallback((swUrl: string, registered: ServiceWorkerRegistration | undefined) => {
    if (!registered) {
      setOfflineCapabilityStatus('error')
      console.warn('Leftly service worker registration returned no registration.', { swUrl })
      return
    }

    setRegistration(registered)
    console.info('Leftly service worker registered.', {
      url: swUrl,
      scope: registered.scope,
      active: Boolean(registered.active),
      waiting: Boolean(registered.waiting),
      installing: Boolean(registered.installing),
    })
    observeRegistration(registered)
  }, [observeRegistration])

  const handleRegisterError = useCallback((error: unknown) => {
    setOfflineCapabilityStatus('error')
    console.warn('Leftly service worker registration failed.', error)
  }, [])

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: handleRegisteredSW,
    onRegisterError: handleRegisterError,
  })

  useEffect(() => {
    if (!supportsServiceWorkers()) {
      return undefined
    }

    function handleControllerChange() {
      const controller = navigator.serviceWorker.controller
      if (controller?.state === 'activated') {
        void navigator.serviceWorker.ready.then((readyRegistration) => {
          if (readyRegistration.active?.state === 'activated') {
            setOfflineCapabilityStatus('ready')
          }
        })
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    void navigator.serviceWorker.ready.then((readyRegistration) => {
      if (readyRegistration.active?.state === 'activated') {
        setOfflineCapabilityStatus('ready')
      }
    }).catch((error) => {
      setOfflineCapabilityStatus('error')
      console.warn('Leftly service worker readiness check failed.', error)
    })

    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as DeferredInstallPrompt)
    }

    function handleAppInstalled() {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt || isInstalled || offlineCapabilityStatus !== 'ready') {
      return
    }

    const prompt = deferredPrompt
    setDeferredPrompt(null)
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      // The browser may dismiss or reject an install prompt without affecting Leftly.
    }
  }, [deferredPrompt, isInstalled, offlineCapabilityStatus])

  const retryOfflineSetup = useCallback(async () => {
    if (isRetryingOfflineSetup || offlineCapabilityStatus === 'unsupported') {
      return
    }

    setIsRetryingOfflineSetup(true)
    setOfflineCapabilityStatus('preparing')
    try {
      await updateServiceWorker(false)
      const currentRegistration = registration ?? (await navigator.serviceWorker.getRegistration())
      if (!currentRegistration) {
        throw new Error('No service-worker registration is available for retry.')
      }

      setRegistration(currentRegistration)
      observeRegistration(currentRegistration)
      await currentRegistration.update()
      await confirmRegistration(currentRegistration)
    } catch (error) {
      setOfflineCapabilityStatus('error')
      console.warn('Leftly service worker retry failed.', error)
    } finally {
      setIsRetryingOfflineSetup(false)
    }
  }, [confirmRegistration, isRetryingOfflineSetup, observeRegistration, offlineCapabilityStatus, registration, updateServiceWorker])

  const acceptUpdate = useCallback(async () => {
    if (isUpdating || reloadStarted) {
      return
    }

    setReloadStarted(true)
    setIsUpdating(true)
    await updateServiceWorker(true)
  }, [isUpdating, reloadStarted, updateServiceWorker])

  return useMemo(
    () => ({
      canInstall: Boolean(deferredPrompt) && !isInstalled && offlineCapabilityStatus === 'ready',
      hasInstallPrompt: Boolean(deferredPrompt) && !isInstalled,
      isInstalled,
      offlineCapabilityStatus,
      isRetryingOfflineSetup,
      isUpdating,
      needRefresh,
      install,
      retryOfflineSetup,
      dismissUpdate: () => setNeedRefresh(false),
      acceptUpdate,
    }),
    [
      acceptUpdate,
      deferredPrompt,
      install,
      isInstalled,
      isRetryingOfflineSetup,
      isUpdating,
      needRefresh,
      offlineCapabilityStatus,
      retryOfflineSetup,
      setNeedRefresh,
    ],
  )
}

function supportsServiceWorkers() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

function getInitialCapabilityStatus(): OfflineCapabilityStatus {
  return supportsServiceWorkers() ? 'preparing' : 'unsupported'
}

function detectInstalledMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}
