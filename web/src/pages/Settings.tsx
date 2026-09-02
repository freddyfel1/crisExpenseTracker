import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Download, HelpCircle, Landmark, LogOut } from 'lucide-react'
import { fetchProfile, updateProfile } from '../data/api'
import { useSession } from '../hooks/useSession'
import { useStore } from '../data/store'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { Card } from '../components/Card'

export function Settings() {
  const { session } = useSession()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const { transactions, categories, budgetSections, budgetLineItems } = useStore()

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
  })
  const saveProfile = useMutation({
    mutationFn: (patch: Partial<Profile>) => updateProfile(userId!, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  if (!profileQuery.data) {
    return <div className="max-w-2xl text-[13px] text-[var(--text-soft)]">Loading…</div>
  }

  const profile = profileQuery.data

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ transactions, categories, budgetSections, budgetLineItems, profile }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `crisexpensetracker_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">Settings</h1>
        <p className="text-[13px] text-[var(--text-soft)]">{session?.user.email}</p>
      </div>

      <Card title="Account">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Name</span>
            <input
              defaultValue={profile.name}
              onBlur={(e) => saveProfile.mutate({ name: e.target.value })}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Currency</span>
            <select
              defaultValue={profile.currency}
              onChange={(e) => saveProfile.mutate({ currency: e.target.value })}
              className="input"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="CAD">CAD — Canadian Dollar</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Notifications">
        <div className="space-y-3">
          <Toggle
            label="Budget alerts"
            sub="Get notified when a category nears its limit"
            checked={profile.notifyBudgetAlerts}
            onChange={(v) => saveProfile.mutate({ notifyBudgetAlerts: v })}
          />
          <Toggle
            label="Weekly summary"
            sub="A recap of spending every Monday"
            checked={profile.notifyWeeklySummary}
            onChange={(v) => saveProfile.mutate({ notifyWeeklySummary: v })}
          />
          <Toggle
            label="Receipt sync"
            sub="Notify when a new receipt syncs from the mobile app"
            checked={profile.notifyReceiptSync}
            onChange={(v) => saveProfile.mutate({ notifyReceiptSync: v })}
          />
        </div>
      </Card>

      <Card title="Bank sync">
        <Link
          to="/transactions/connect-bank"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:underline"
        >
          <Landmark size={15} /> Connect to bank
        </Link>
      </Card>

      <Card title="Help">
        <Link
          to="/how-to"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:underline"
        >
          <HelpCircle size={15} /> How to use this app
        </Link>
      </Card>

      <Card title="Data">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportBackup}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
          >
            <Download size={15} /> Export all data (JSON)
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--warn)] hover:bg-[var(--warn-soft)]"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </Card>
    </div>
  )
}

function Toggle({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium text-[var(--ink)]">{label}</p>
        <p className="text-[12px] text-[var(--text-soft)]">{sub}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
