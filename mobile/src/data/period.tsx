import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { currentMonthKey } from './selectors'

// Mirrors web/src/data/period.tsx — shared across the Dashboard and Budget Planner tabs
// so both browse the same month, the way budget sections/line items and monthly income
// are all scoped by monthKey in the database.
interface PeriodValue {
  month: string // YYYY-MM
  setMonth: (m: string) => void
}

const PeriodContext = createContext<PeriodValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonthKey())
  const value = useMemo(() => ({ month, setMonth }), [month])
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider')
  return ctx
}
