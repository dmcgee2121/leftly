import { useCallback, useEffect, useMemo, useState } from 'react'

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type PwaLifecycleState = {
  canInstall: boolean
  isInstalled: boolean
  install: () => Promise<void>
}

export function usePwaLifecycle(): PwaLifecycleState {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => detectInstalledMode())

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
    if (!deferredPrompt || isInstalled) {
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
  }, [deferredPrompt, isInstalled])

  return useMemo(
    () => ({
      canInstall: Boolean(deferredPrompt) && !isInstalled,
      isInstalled,
      install,
    }),
    [deferredPrompt, install, isInstalled],
  )
}

function detectInstalledMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}
