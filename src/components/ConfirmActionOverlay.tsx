import { useRef } from 'react'
import type { ReactNode } from 'react'
import { AppOverlay } from './AppOverlay'

export type ConfirmActionDetail = { label: string; value: ReactNode }

export function ConfirmActionOverlay({
  isOpen,
  title,
  description,
  details = [],
  cancelLabel = 'Cancel',
  confirmLabel,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean
  title: string
  description: string
  details?: ConfirmActionDetail[]
  cancelLabel?: string
  confirmLabel: string
  isSubmitting?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  return (
    <AppOverlay
      id="leftly-confirm-action-overlay"
      isOpen={isOpen}
      title={title}
      description={description}
      desktopPresentation="dialog"
      closeLabel={cancelLabel}
      initialFocusRef={cancelRef}
      onClose={() => {
        if (!isSubmitting) onCancel()
      }}
    >
      <div className="grid gap-4">
        {details.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label} className="leftly-shell-faint min-w-0 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{detail.label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-white">{detail.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="leftly-banner-danger" role="alert">
          <p className="text-sm leading-6">This action changes data saved on this device.</p>
        </div>
        <div className="leftly-action-grid sm:flex sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={isSubmitting} className="button-secondary w-full sm:w-auto">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isSubmitting} className="button-danger w-full sm:w-auto">
            {isSubmitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </AppOverlay>
  )
}
