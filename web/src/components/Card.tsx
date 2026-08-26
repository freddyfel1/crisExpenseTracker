import type { ReactNode } from 'react'

interface Props {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, action, children, className = '' }: Props) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-[14px] font-semibold text-[var(--ink)]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
