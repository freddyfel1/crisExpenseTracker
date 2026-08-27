import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'forgot-password'>('sign-in')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmNotice, setConfirmNotice] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'forgot-password') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      setLoading(false)
      if (resetError) {
        setError(resetError.message)
        return
      }
      setResetSent(true)
      return
    }

    const { data, error: authError } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (authError) {
      setError(authError.message)
      return
    }
    if (mode === 'sign-up' && !data.session) setConfirmNotice(true)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 flex items-center justify-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary)] text-white">
          <Wallet size={18} />
        </div>
        <p className="font-display text-[19px] text-[var(--ink)]">crisExpenseTracker</p>
      </div>

      {confirmNotice ? (
        <p className="text-center text-[13px] text-[var(--text)]">
          Check your email to confirm your account, then sign in.
        </p>
      ) : resetSent ? (
        <p className="text-center text-[13px] text-[var(--text)]">
          Check your email for a link to reset your password.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          {mode !== 'forgot-password' && (
            <input
              type="password"
              required
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          )}
          {mode === 'sign-in' && (
            <button
              type="button"
              onClick={() => setMode('forgot-password')}
              className="block text-right text-[12px] text-[var(--text-soft)]"
            >
              Forgot password?
            </button>
          )}
          {error && <p className="text-[13px] text-[var(--warn)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : mode === 'sign-up'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : mode === 'forgot-password' ? 'sign-in' : 'sign-up')}
            className="w-full text-center text-[12.5px] text-[var(--text-soft)]"
          >
            {mode === 'sign-in'
              ? "Don't have an account? Sign up"
              : mode === 'sign-up'
                ? 'Already have an account? Sign in'
                : 'Back to sign in'}
          </button>
        </form>
      )}
    </div>
  )
}
