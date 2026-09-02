import type { ReactNode } from 'react'
import {
  LayoutDashboard,
  Receipt,
  Tags,
  FileSpreadsheet,
  PiggyBank,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'
import { Card } from '../components/Card'

export function HowTo() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">How To</h1>
        <p className="text-[13px] text-[var(--text-soft)]">A quick guide to each part of the app.</p>
      </div>

      <Section icon={<LayoutDashboard size={16} />} title="Dashboard">
        <p>
          Your month-at-a-glance overview. Start here: tap the <b>Income</b> card and enter your{' '}
          <b>monthly net pay</b> — the take-home amount that actually lands in your bank account after
          taxes and other deductions, not your gross salary. Use <b>Other income</b> for anything else
          coming in — Social Security, a side hustle, a second job, or a spouse's pay. Everything else on
          this page (Total income, Total expense,
          Difference, and the charts) is calculated automatically from your income and transactions.
        </p>
      </Section>

      <Section icon={<Receipt size={16} />} title="Transactions">
        <p>Every purchase you log lives here. There are two ways to add one:</p>
        <div>
          <p className="font-medium text-[var(--ink)]">Adding a transaction by hand</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Tap <b>Add transaction</b> — a panel slides in from the right.
            </li>
            <li>Fill in the merchant, date, and amount (required).</li>
            <li>Pick a category, and optionally add tax, tip, payment method, or notes.</li>
            <li>
              Tap <b>Add transaction</b> at the bottom of the panel to save it.
            </li>
          </ol>
        </div>
        <div>
          <p className="font-medium text-[var(--ink)]">Using Capture receipt</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Tap <b>Capture receipt</b> and take a photo of the receipt (or choose one from your
              photos).
            </li>
            <li>
              The app uploads it and reads it automatically — merchant, amount, date, and category get
              filled in for you.
            </li>
            <li>
              The transaction detail panel opens with those fields pre-filled so you can check them and
              fix anything that was read wrong, then save.
            </li>
            <li>
              If the automatic read fails, a blank transaction with the receipt photo attached is still
              created — just fill in the details by hand and save.
            </li>
          </ol>
        </div>
        <p>
          Use the search box and the Year/Month/Category dropdowns to narrow the list. The stat cards
          above the table show income/expense/balance for the selected month, plus a running
          year-to-date total.
        </p>
      </Section>

      <Section icon={<Tags size={16} />} title="Categories">
        <p>
          Manage the categories your transactions are sorted into (Groceries, Home, Pet care, etc.).
          Add, rename, recolor, or delete categories here — changes apply everywhere else in the app.
        </p>
      </Section>

      <Section icon={<FileSpreadsheet size={16} />} title="Budget Planner">
        <p>
          Plan a month's budget like a spreadsheet: group planned costs into sections (Home, Utilities,
          Savings, etc.) and add line items with a monthly amount. This is separate from your actual
          Transactions — it's what you intend to spend, not what you've spent. Name a section
          "Savings" and its line items count as savings instead of expenses in the summary. The planner
          is month-scoped, so opening a new month copies your existing structure forward with amounts
          reset to zero.
        </p>
      </Section>

      <Section icon={<PiggyBank size={16} />} title="Savings Goals">
        <p>
          Set targets for things you're saving toward — a vacation, an emergency fund, anything with a
          dollar amount. Add a goal, set a target amount and (optionally) a target date, then update the
          "Saved" amount as you set money aside. A progress bar shows how close you are.
        </p>
      </Section>

      <Section icon={<BarChart3 size={16} />} title="Reports">
        <p>
          See where your money goes: top categories, top merchants, and a full 12-month spending chart
          for whatever year you pick. Narrow it further with the Month filter, or export the selected
          period to CSV.
        </p>
      </Section>

      <Section icon={<SettingsIcon size={16} />} title="Settings">
        <p>
          Update your name and currency, control notifications, and manage your account.
        </p>
      </Section>
    </div>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card
      title={title}
      action={<span className="text-[var(--text-soft)]">{icon}</span>}
    >
      <div className="space-y-2 text-[13.5px] leading-relaxed text-[var(--text)]">{children}</div>
    </Card>
  )
}
