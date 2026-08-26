import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { currentMonthKey } from '../utils/format'

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
