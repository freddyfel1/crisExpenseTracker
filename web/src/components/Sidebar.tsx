import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  Receipt,
  Tags,
  BarChart3,
  Settings as SettingsIcon,
  Wallet,
  FileSpreadsheet,
  PiggyBank,
  HelpCircle,
  Landmark,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    to: '/transactions',
    label: 'Transactions',
    icon: Receipt,
    children: [{ to: '/transactions/connect-bank', label: 'Connect to bank', icon: Landmark }],
  },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/budget-planner', label: 'Budget Planner', icon: FileSpreadsheet },
  { to: '/savings-goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/how-to', label: 'How To', icon: HelpCircle },
]

const MIN_WIDTH = 180
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 240
const STORAGE_KEY = 'sidebar-width'

export function Sidebar() {
  const asideRef = useRef<HTMLElement>(null)
  const draggingRef = useRef(false)
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH
  })

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !asideRef.current) return
      const left = asideRef.current.getBoundingClientRect().left
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - left))
      setWidth(next)
    }
    function handleMouseUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  function handleResizeStart() {
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <aside
      ref={asideRef}
      className="relative hidden md:flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6"
      style={{ width }}
    >
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary)] text-white">
          <Wallet size={18} />
        </div>
        <div>
          <p className="font-display text-[17px] leading-tight text-[var(--ink)]">crisExpense</p>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Tracker</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, children }) => (
          <div key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary-ink)] font-medium'
                    : 'text-[var(--text)] hover:bg-[var(--paper)]'
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
            {children && (
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-[var(--border)] pl-3">
                {children.map(({ to: childTo, label: childLabel, icon: ChildIcon }) => (
                  <NavLink
                    key={childTo}
                    to={childTo}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? 'bg-[var(--primary-soft)] text-[var(--primary-ink)] font-medium'
                          : 'text-[var(--text-soft)] hover:bg-[var(--paper)]'
                      }`
                    }
                  >
                    <ChildIcon size={15} strokeWidth={2} />
                    {childLabel}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-[var(--border-soft)] bg-[var(--paper)] p-3">
        <p className="text-[12px] text-[var(--text-soft)]">
          Capture a receipt here or on the crisExpenseTracker mobile app — either way it syncs automatically.
        </p>
      </div>

      <div
        onMouseDown={handleResizeStart}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        className="absolute top-0 -right-1 h-full w-2 cursor-col-resize group"
        title="Drag to resize, double-click to reset"
      >
        <div className="mx-auto h-full w-px bg-transparent group-hover:bg-[var(--primary)] transition-colors" />
      </div>
    </aside>
  )
}
