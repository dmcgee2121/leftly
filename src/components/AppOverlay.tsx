import { useEffect, useId, useRef } from 'react'
import type { MutableRefObject, ReactNode, RefObject } from 'react'

type DesktopPresentation = 'drawer' | 'dialog'
type DesktopSize = 'standard' | 'wide'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function AppOverlay({
  id,
  isOpen,
  title,
  description,
  closeLabel = 'Close panel',
  desktopPresentation = 'drawer',
  desktopSize = 'standard',
  initialFocusRef,
  onClose,
  children,
}: {
  id: string
  isOpen: boolean
  title: string
  description?: string
  closeLabel?: string
  desktopPresentation?: DesktopPresentation
  desktopSize?: DesktopSize
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement | null>(null)
  const lastBodyOverflowRef = useRef('')
  const lastBodyPaddingRightRef = useRef('')

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const body = document.body
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth
    lastBodyOverflowRef.current = body.style.overflow
    lastBodyPaddingRightRef.current = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`
    }

    return () => {
      body.style.overflow = lastBodyOverflowRef.current
      body.style.paddingRight = lastBodyPaddingRightRef.current
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const activePanel = panelRef.current
    if (!activePanel) {
      return undefined
    }
    const panel: HTMLElement = activePanel

    const focusTarget = initialFocusRef?.current ?? getFocusableElements(panel)[0] ?? panel
    const focusTimer = window.setTimeout(() => {
      focusTarget.focus()
    }, 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(panel)
      if (focusableElements.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (activeElement === first || activeElement === panel) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [initialFocusRef, isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[70]" aria-hidden={false}>
      <div className="leftly-overlay-backdrop" aria-hidden="true" />
      <div
        className={`fixed inset-0 flex items-end justify-center p-3 sm:p-4 ${
          desktopPresentation === 'dialog' ? 'md:items-center md:justify-center' : 'md:items-stretch md:justify-end'
        }`}
        onClick={onClose}
      >
        <section
          id={id}
          ref={panelRef as MutableRefObject<HTMLElement | null>}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={`leftly-overlay-shell ${
            desktopPresentation === 'dialog'
              ? 'leftly-overlay-shell-dialog'
              : `leftly-overlay-shell-drawer ${desktopSize === 'wide' ? 'leftly-overlay-shell-drawer-wide' : ''}`
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="leftly-overlay-header">
            <div className="min-w-0">
              <h2 id={titleId} className="leftly-section-title">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="leftly-section-helper">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="button-secondary w-full shrink-0 sm:w-auto">
              Close
            </button>
          </div>
          <div className="leftly-overlay-body">{children}</div>
        </section>
      </div>
    </div>
  )
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('hidden') && element.tabIndex !== -1 && !element.getAttribute('aria-hidden'),
  )
}
