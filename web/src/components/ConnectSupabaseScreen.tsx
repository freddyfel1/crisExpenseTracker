export function ConnectSupabaseScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-[26px] text-[var(--ink)]">Connect Supabase</h1>
      <p className="text-[13px] leading-relaxed text-[var(--text-soft)]">
        This dashboard needs a Supabase project to store transactions, categories, and budgets —
        the same database the mobile app uses.
      </p>
      <Step title="1. Create a project" body="Free tier at supabase.com." />
      <Step title="2. Run the migration" body="supabase/migrations/, via the SQL Editor." />
      <Step
        title="3. Add credentials"
        body="Create web/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server."
      />
      <p className="text-[12px] text-[var(--text-soft)]">Full steps: supabase/README.md</p>
    </div>
  )
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[13px] font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-[12.5px] text-[var(--text-soft)]">{body}</p>
    </div>
  )
}
