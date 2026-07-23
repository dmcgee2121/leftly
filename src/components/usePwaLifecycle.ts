import { useCallback, useEffect, useMemo, useState } from 'react'
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
    void confirmActiveRegistration(registered, setOfflineCapabilityStatus)
  }, [])

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
      if (navigator.serviceWorker.controller) {
        setOfflineCapabilityStatus('ready')
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    void navigator.serviceWorker.ready.then((readyRegistration) => {
      if (readyRegistration.active || navigator.serviceWorker.controller) {
        setOfflineCapabilityStatus('ready')
      }
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
      const currentRegistration = registration ?? (await navigator.serviceWorker.getRegistration())
      if (!currentRegistration) {
        console.info('Retrying Leftly service worker setup with an explicit page reload.')
        window.location.reload()
        return
      }

      setRegistration(currentRegistration)
      await currentRegistration.update()
      await confirmActiveRegistration(currentRegistration, setOfflineCapabilityStatus)
    } catch (error) {
      setOfflineCapabilityStatus('error')
      console.warn('Leftly service worker retry failed.', error)
    } finally {
      setIsRetryingOfflineSetup(false)
    }
  }, [isRetryingOfflineSetup, offlineCapabilityStatus, registration])

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

async function confirmActiveRegistration(
  registration: ServiceWorkerRegistration,
  setStatus: (status: OfflineCapabilityStatus) => void,
) {
  if (!supportsServiceWorkers()) {
    setStatus('unsupported')
    return
  }

  try {
    const readyRegistration = await navigator.serviceWorker.ready
    if (readyRegistration.active || registration.active || navigator.serviceWorker.controller) {
      setStatus('ready')
      return
    }
    setStatus('error')
  } catch (error) {
    setStatus('error')
    console.warn('Leftly could not confirm an active service worker.', {
      scope: registration.scope,
      active: Boolean(registration.active),
      waiting: Boolean(registration.waiting),
      installing: Boolean(registration.installing),
      error,
    })
  }
}

function detectInstalledMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}
