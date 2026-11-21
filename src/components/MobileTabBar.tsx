import type { ReactNode } from 'react'

// Phone-only bottom navigation: four tabs with icons plus a raised Quick Add button in the middle.

export type MobileTabId = 'overview' | 'quick-add' | 'recurring' | 'history' | 'more'

type MobileTabBarProps = {
  activeTab: MobileTabId | null
  hasPayPeriod: boolean
  quickAddOverlayId: string
  moreOverlayId: string
  isQuickAddOpen: boolean
  isMoreOpen: boolean
  onOverview: () => void
  onQuickAdd: () => void
  onBillPlan: () => void
  onHistory: () => void
  onMore: () => void
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

const icons = {
  overview: (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  ),
  billPlan: (
    <Icon>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
      <path d="m9 15 2 2 4-4" />
    </Icon>
  ),
  history: (
    <Icon>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </Icon>
  ),
  more: (
    <Icon>
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </Icon>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
}

function TabButton({
  label,
  icon,
  isActive,
  onClick,
  ariaLabel,
  dialogId,
  isDialogOpen,
}: {
  label: string
  icon: ReactNode
  isActive: boolean
  onClick: () => void
  ariaLabel: string
  dialogId?: string
  isDialogOpen?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={isActive && !dialogId ? 'page' : undefined}
      aria-pressed={isActive}
      aria-controls={dialogId}
      aria-expanded={dialogId ? isDialogOpen : undefined}
      aria-haspopup={dialogId ? 'dialog' : undefined}
      className={`leftly-tab ${isActive ? 'leftly-tab-active' : ''}`}
    >
      <span className="leftly-tab-icon">{icon}</span>
      <span className="leftly-tab-label">{label}</span>
    </button>
  )
}

export function MobileTabBar({
  activeTab,
  hasPayPeriod,
  quickAddOverlayId,
  moreOverlayId,
  isQuickAddOpen,
  isMoreOpen,
  onOverview,
  onQuickAdd,
  onBillPlan,
  onHistory,
  onMore,
}: MobileTabBarProps) {
  return (
    <nav aria-label="Main" className="leftly-tab-bar md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 items-end">
        <TabButton label="Overview" ariaLabel="Go to Overview" icon={icons.overview} isActive={activeTab === 'overview'} onClick={onOverview} />
        <TabButton label="Bill Plan" ariaLabel="Go to Bill Plan" icon={icons.billPlan} isActive={activeTab === 'recurring'} onClick={onBillPlan} />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label={hasPayPeriod ? 'Add an expense' : 'Set up a paycheck to start adding expenses'}
            aria-controls={hasPayPeriod ? quickAddOverlayId : undefined}
            aria-expanded={hasPayPeriod ? isQuickAddOpen : undefined}
            aria-haspopup={hasPayPeriod ? 'dialog' : undefined}
            className={`leftly-tab-add ${activeTab === 'quick-add' ? 'leftly-tab-add-active' : ''}`}
          >
            {icons.plus}
          </button>
        </div>
        <TabButton label="History" ariaLabel="Go to History" icon={icons.history} isActive={activeTab === 'history'} onClick={onHistory} />
        <TabButton
          label="More"
          ariaLabel="Open More"
          icon={icons.more}
          isActive={activeTab === 'more'}
          onClick={onMore}
          dialogId={moreOverlayId}
          isDialogOpen={isMoreOpen}
        />
      </div>
    </nav>
  )
}
