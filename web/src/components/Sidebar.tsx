import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Tags,
  BarChart3,
  Settings as SettingsIcon,
  Wallet,
  FileSpreadsheet,
  PiggyBank,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/budget-planner', label: 'Budget Planner', icon: FileSpreadsheet },
  { to: '/savings-goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
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
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
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
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-[var(--border-soft)] bg-[var(--paper)] p-3">
        <p className="text-[12px] text-[var(--text-soft)]">
          Capture a receipt here or on the crisExpenseTracker mobile app — either way it syncs automatically.
        </p>
      </div>
    </aside>
  )
}
