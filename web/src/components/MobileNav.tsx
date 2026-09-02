import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Tags, BarChart3, Settings as SettingsIcon, FileSpreadsheet, PiggyBank } from 'lucide-react'

const ITEMS = [
  { to: '/', icon: LayoutDashboard, end: true, label: 'Home' },
  { to: '/transactions', icon: Receipt, label: 'Txns' },
  { to: '/categories', icon: Tags, label: 'Categories' },
  { to: '/budget-planner', icon: FileSpreadsheet, label: 'Planner' },
  { to: '/savings-goals', icon: PiggyBank, label: 'Goals' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[var(--border)] bg-[var(--surface)] py-2 md:hidden">
      {ITEMS.map(({ to, icon: Icon, end, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 text-[10px] ${
              isActive ? 'text-[var(--primary)]' : 'text-[var(--text-soft)]'
            }`
          }
        >
          <Icon size={19} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
