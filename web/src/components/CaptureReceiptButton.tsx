import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { parseReceipt, uploadReceiptPhoto, upsertTransaction } from '../data/api'

export function CaptureReceiptButton() {
  const { session } = useSession()
  const userId = session?.user.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'reading'>('idle')

  const handleFile = async (file: File) => {
    if (!userId) return
    const id = crypto.randomUUID()
    setStage('uploading')
    try {
      const path = await uploadReceiptPhoto(userId, file)
      await upsertTransaction(userId, {
        id,
        merchant: 'New receipt',
        amount: 0,
        date: new Date().toISOString(),
        categoryId: null,
        tags: [],
        receiptImagePath: path,
      })

      setStage('reading')
      try {
        const parsed = await parseReceipt(path)
        if (!parsed.error) {
          await upsertTransaction(userId, {
            id,
            merchant: parsed.merchant || 'New receipt',
            amount: parsed.amount ?? 0,
            date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
            categoryId: parsed.categoryId ?? null,
            tax: parsed.tax ?? null,
            tip: parsed.tip ?? null,
            tags: [],
            receiptImagePath: path,
          })
        }
      } catch {
        // Auto-extraction is best-effort — the blank transaction we already saved
        // is still there for the user to fill in by hand.
      }

      queryClient.invalidateQueries({ queryKey: ['transactions', userId] })
      navigate(`/transactions/${id}`)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setStage('idle')
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) handleFile(file)
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={stage !== 'idle'}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
      >
        <Camera size={15} />
        {stage === 'uploading' ? 'Uploading…' : stage === 'reading' ? 'Reading receipt…' : 'Capture receipt'}
      </button>
    </>
  )
}
