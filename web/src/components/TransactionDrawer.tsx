import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useStore } from '../data/store'
import type { Transaction } from '../types'
import { ReceiptThumb } from './ReceiptThumb'
import { resolveCategory } from '../utils/resolveCategory'

interface Props {
  id: string
  onClose: () => void
}

function emptyTransaction(): Transaction {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    merchant: '',
    categoryId: null,
    amount: 0,
    paymentMethod: '',
    tags: [],
  }
}

export function TransactionDrawer({ id, onClose }: Props) {
  const { transactions, categories, addTransaction, updateTransaction, deleteTransaction } = useStore()
  const isNew = id === 'new'
  const existing = transactions.find((t) => t.id === id)
  const [draft, setDraft] = useState<Transaction>(existing ?? emptyTransaction())

  useEffect(() => {
    setDraft(existing ?? emptyTransaction())
  }, [id, existing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!isNew && !existing) {
    return null
  }

  const category = resolveCategory(categories, draft.categoryId)

  const handleSave = () => {
    if (!draft.merchant.trim()) return
    if (isNew) addTransaction(draft)
    else updateTransaction(id, draft)
    onClose()
  }

  const handleDelete = () => {
    deleteTransaction(id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[20px] text-[var(--ink)]">
            {isNew ? 'Add transaction' : 'Transaction detail'}
          </h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--paper)]">
            <X size={17} />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <ReceiptThumb color={category.color} size={56} />
          <p className="text-[12px] text-[var(--text-soft)]">
            {draft.receiptImagePath ? 'Extracted from a receipt photo.' : 'Manually entered.'}
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Merchant">
            <input
              value={draft.merchant}
              onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
              className="input"
              placeholder="e.g. Trader Joe's"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={draft.date.slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, date: new Date(e.target.value).toISOString() })}
                className="input"
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                className="input font-mono"
              />
            </Field>
          </div>

          <Field label="Category">
            <select
              value={draft.categoryId ?? ''}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || null })}
              className="input"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax">
              <input
                type="number"
                step="0.01"
                value={draft.tax ?? ''}
                onChange={(e) => setDraft({ ...draft, tax: e.target.value ? Number(e.target.value) : undefined })}
                className="input font-mono"
              />
            </Field>
            <Field label="Tip">
              <input
                type="number"
                step="0.01"
                value={draft.tip ?? ''}
                onChange={(e) => setDraft({ ...draft, tip: e.target.value ? Number(e.target.value) : undefined })}
                className="input font-mono"
              />
            </Field>
          </div>

          <Field label="Payment method">
            <input
              value={draft.paymentMethod ?? ''}
              onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="input min-h-[72px] resize-none"
              placeholder="Optional notes"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            {isNew ? 'Add transaction' : 'Save changes'}
          </button>
          {!isNew && (
            <button
              onClick={handleDelete}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] text-[var(--warn)] hover:bg-[var(--warn-soft)]"
              aria-label="Delete transaction"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">{label}</span>
      {children}
    </label>
  )
}
