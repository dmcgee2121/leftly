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
  const observedWorkers = useRef(new WeakSet<ServiceWorker>())
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const serviceWorkerUrlRef = useRef<string | null>(null)
  const statusRef = useRef(offlineCapabilityStatus)
  const lastUpdateCheckAt = useRef(0)
  const updateCheckRunning = useRef(false)
  const registrationCleanup = useRef<(() => void)[]>([])
  const setNeedRefreshRef = useRef<(value: boolean) => void>(() => undefined)

  useEffect(() => {
    statusRef.current = offlineCapabilityStatus
  }, [offlineCapabilityStatus])

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
    const observeWorker = (worker: ServiceWorker | null) => {
      if (!worker || observedWorkers.current.has(worker)) {
        return
      }

      observedWorkers.current.add(worker)
      const handleStateChange = () => {
        if (worker.state === 'installed' && candidate.active) {
          setNeedRefreshRef.current(true)
        }
        if (worker.state === 'activated') {
          void confirmRegistration(candidate)
        }
      }
      worker.addEventListener('statechange', handleStateChange)
      registrationCleanup.current.push(() => worker.removeEventListener('statechange', handleStateChange))
      handleStateChange()
    }

    const handleUpdateFound = () => {
      observeWorker(candidate.installing)
    }
    candidate.addEventListener('updatefound', handleUpdateFound)
    registrationCleanup.current.push(() => candidate.removeEventListener('updatefound', handleUpdateFound))
    observeWorker(candidate.installing)
    observeWorker(candidate.waiting)
    observeWorker(candidate.active)
    if (candidate.waiting) {
      setNeedRefreshRef.current(true)
    }
    void confirmRegistration(candidate)
  }, [confirmRegistration])

  const checkForPwaUpdate = useCallback(async () => {
    const candidate = registrationRef.current
    const swUrl = serviceWorkerUrlRef.current
    const now = Date.now()

    if (
      !supportsServiceWorkers() ||
      !candidate ||
      !swUrl ||
      !navigator.onLine ||
      candidate.installing ||
      updateCheckRunning.current ||
      now - lastUpdateCheckAt.current < 60_000
    ) {
      return
    }

    lastUpdateCheckAt.current = now
    updateCheckRunning.current = true
    try {
      if (candidate.waiting) {
        setNeedRefreshRef.current(true)
        return
      }

      const serviceWorkerUrl = new URL(swUrl, window.location.href).href
      const response = await fetch(serviceWorkerUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      if (!response.ok) {
        throw new Error(`Service-worker check returned ${response.status}.`)
      }

      await candidate.update()
      if (candidate.waiting) {
        setNeedRefreshRef.current(true)
      }
    } catch (error) {
      console.warn('Leftly service-worker update check failed.', {
        scope: candidate.scope,
        url: swUrl,
        error,
      })
    } finally {
      updateCheckRunning.current = false
    }
  }, [])

  const handleRegisteredSW = useCallback((swUrl: string, registered: ServiceWorkerRegistration | undefined) => {
    serviceWorkerUrlRef.current = swUrl
    if (!registered) {
      setOfflineCapabilityStatus('error')
      console.warn('Leftly service worker registration returned no registration.', { swUrl })
      return
    }

    registrationRef.current = registered
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
    setNeedRefreshRef.current = setNeedRefresh
  }, [setNeedRefresh])

  useEffect(() => {
    const cleanup = registrationCleanup.current
    return () => {
      cleanup.splice(0).forEach((removeListener) => removeListener())
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => void checkForPwaUpdate(), 60 * 60 * 1_000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForPwaUpdate()
      }
    }
    const handleOnline = () => void checkForPwaUpdate()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [checkForPwaUpdate])

  useEffect(() => {
    if (!registration || statusRef.current !== 'ready') {
      return undefined
    }

    const initialConfirmedCheck = window.setTimeout(() => void checkForPwaUpdate(), 2_000)
    return () => window.clearTimeout(initialConfirmedCheck)
  }, [checkForPwaUpdate, registration, offlineCapabilityStatus])

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
