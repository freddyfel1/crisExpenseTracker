import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 flex items-center justify-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary)] text-white">
          <Wallet size={18} />
        </div>
        <p className="font-display text-[19px] text-[var(--ink)]">crisExpenseTracker</p>
      </div>

      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-[13px] text-[var(--text)]">Your password has been updated.</p>
          <button
            onClick={onDone}
            className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Continue
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="mb-1 text-[13px] text-[var(--text-soft)]">Choose a new password.</p>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoFocus
          />
          {error && <p className="text-[13px] text-[var(--warn)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      )}
    </div>
  )
}
