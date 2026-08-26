import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import type { Category } from '../types'
import { CategoryIcon } from '../components/CategoryIcon'
import { spendByCategory } from '../data/selectors'
import { formatMoney } from '../utils/format'

const ICON_CHOICES = [
  'UtensilsCrossed', 'ShoppingBasket', 'Bus', 'Fuel', 'ShoppingBag', 'Receipt', 'Home',
  'HeartPulse', 'Clapperboard', 'Plane', 'GraduationCap', 'RefreshCcw', 'Sparkles', 'Gift',
  'Briefcase', 'CircleDashed', 'Coffee', 'Dumbbell', 'Wallet', 'PawPrint',
]

const COLOR_CHOICES = [
  '#b4483a', '#2f6f52', '#3b6e8f', '#a15c2f', '#8a5fb0', '#5a5f52', '#1e4a37', '#c0546b',
  '#b3872f', '#3f7d7a', '#4a5a8f', '#6b6f3f', '#b0708a', '#c46b3f', '#3f4f6b', '#7c8175',
]

function emptyCategory(): Category {
  return { id: crypto.randomUUID(), name: '', icon: 'CircleDashed', color: '#7c8175' }
}

export function Categories() {
  const { categories, transactions, addCategory, updateCategory, deleteCategory } = useStore()
  const [editing, setEditing] = useState<Category | null>(null)
  const [isNew, setIsNew] = useState(false)

  const totals = new Map(spendByCategory(transactions).map((s) => [s.categoryId, s.total]))

  const openNew = () => {
    setEditing(emptyCategory())
    setIsNew(true)
  }

  const openEdit = (c: Category) => {
    setEditing({ ...c })
    setIsNew(false)
  }

  const save = () => {
    if (!editing || !editing.name.trim()) return
    if (isNew) addCategory(editing)
    else updateCategory(editing.id, editing)
    setEditing(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Categories</h1>
          <p className="text-[13px] text-[var(--text-soft)]">{categories.length} categories</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          <Plus size={15} /> New category
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
              style={{ background: `${c.color}14`, color: c.color }}
            >
              <CategoryIcon name={c.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[var(--ink)]">{c.name}</p>
              <p className="font-mono text-[12px] text-[var(--text-soft)]">
                {formatMoney(totals.get(c.id) ?? 0)} all-time
              </p>
            </div>
            <button
              onClick={() => openEdit(c)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--paper)]"
              aria-label="Edit category"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => deleteCategory(c.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
              aria-label="Delete category"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display mb-4 text-[19px] text-[var(--ink)]">
              {isNew ? 'New category' : 'Edit category'}
            </h2>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Name</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input"
                placeholder="e.g. Pets"
                autoFocus
              />
            </label>

            <div className="mb-4">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Icon</span>
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setEditing({ ...editing, icon })}
                    className={`grid h-8 w-8 place-items-center rounded-md border ${
                      editing.icon === icon ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-[var(--border)]'
                    }`}
                  >
                    <CategoryIcon name={icon} size={14} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Color</span>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_CHOICES.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditing({ ...editing, color })}
                    className="h-7 w-7 rounded-full"
                    style={{
                      background: color,
                      outline: editing.color === color ? `2px solid ${color}` : 'none',
                      outlineOffset: 2,
                    }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
