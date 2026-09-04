import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useStore } from '../data/store'
import { looksLikeBinarySpreadsheet, parseBankCsv, type ParsedCsvRow } from '../utils/parseBankCsv'
import { formatDate, formatMoney } from '../utils/format'
import { Card } from '../components/Card'

interface Candidate extends ParsedCsvRow {
  key: string
  selected: boolean
  duplicate: boolean
  possibleDuplicate: boolean
}

export function UploadTransactions() {
  const { transactions, importTransactions, isImportingTransactions } = useStore()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [creditCount, setCreditCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Two tiers: an exact match on date + amount + merchant text is a near-certain
  // duplicate. A match on just date + amount is softer — Plaid's cleaned-up merchant
  // name and a bank's raw CSV description often don't match textually even for the
  // same real transaction, so this still needs to be surfaced, just not as certainly.
  const existingKeys = useMemo(
    () => new Set(transactions.map((t) => `${t.date}|${t.amount}|${t.merchant.toLowerCase()}`)),
    [transactions],
  )
  const existingDateAmountKeys = useMemo(
    () => new Set(transactions.map((t) => `${t.date}|${t.amount}`)),
    [transactions],
  )

  const handleFile = async (file: File) => {
    setError(null)
    setImported(null)
    setFileName(file.name)

    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    if (looksLikeBinarySpreadsheet(header)) {
      setError(
        'That looks like a real Excel file, not CSV text. In your bank’s download options, choose CSV ' +
          '(or open the file in Excel and use "Save As → CSV") and upload that instead.',
      )
      setCandidates(null)
      return
    }

    const text = await file.text()
    const { rows, creditCount: credits } = parseBankCsv(text)
    if (rows.length === 0) {
      setError('No debit transactions found in that file. Expected a CSV with Date, Description, and Amount columns.')
      setCandidates(null)
      return
    }
    setCreditCount(credits)
    setCandidates(
      rows.map((r, i) => {
        const key = `${r.date}|${r.amount}|${r.merchant.toLowerCase()}`
        const duplicate = existingKeys.has(key)
        const possibleDuplicate = !duplicate && existingDateAmountKeys.has(`${r.date}|${r.amount}`)
        return {
          ...r,
          key: `${i}-${key}`,
          selected: !duplicate && !possibleDuplicate && !r.isLikelyTransfer,
          duplicate,
          possibleDuplicate,
        }
      }),
    )
  }

  const toggle = (key: string) => {
    setCandidates((prev) => prev && prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c)))
  }

  // "Select all" deliberately leaves duplicate-flagged rows alone rather than
  // force-checking them — re-including an already-imported transaction has to be
  // a deliberate per-row choice, not a side effect of a bulk action.
  const selectAll = () => {
    setCandidates(
      (prev) => prev && prev.map((c) => (c.duplicate || c.possibleDuplicate ? c : { ...c, selected: true })),
    )
  }
  const deselectAll = () => {
    setCandidates((prev) => prev && prev.map((c) => ({ ...c, selected: false })))
  }

  const selectedRows = candidates?.filter((c) => c.selected) ?? []

  const handleImport = async () => {
    if (selectedRows.length === 0) return
    const flaggedSelected = selectedRows.filter((r) => r.duplicate || r.possibleDuplicate).length
    if (flaggedSelected > 0) {
      const noun = flaggedSelected === 1 ? 'transaction looks' : 'transactions look'
      const ok = window.confirm(
        `${flaggedSelected} selected ${noun} like it might already be in your transactions (same date and ` +
          `amount, possibly with a different description). Import anyway and risk a duplicate?`,
      )
      if (!ok) return
    }
    await importTransactions(
      selectedRows.map((r) => ({ date: r.date, merchant: r.merchant, amount: r.amount, paymentMethod: r.paymentMethod })),
    )
    setImported(selectedRows.length)
    setCandidates(null)
    setFileName(null)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">Upload docs</h1>
        <p className="text-[13px] text-[var(--text-soft)]">
          Prefer not to link your bank account? Upload a CSV export of your statement instead — nothing is
          shared with any third party, and you choose exactly which transactions get imported. If your
          bank's download only offers "Excel", pick the CSV / comma-delimited option in that dialog, or
          open the download in Excel and use Save As → CSV.
        </p>
      </div>

      <Card title="Upload a bank statement">
        {imported !== null && (
          <p className="mb-4 rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-[13px] text-[var(--primary-ink)]">
            Imported {imported} transaction{imported === 1 ? '' : 's'}.{' '}
            <button onClick={() => navigate('/transactions')} className="font-medium hover:underline">
              View transactions
            </button>
          </p>
        )}

        {!candidates ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed py-12 text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)] ${
              dragActive ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)]'
            }`}
          >
            <Upload size={22} />
            <span className="text-[13px] font-medium">{fileName ?? 'Choose a CSV file, or drag one here'}</span>
            <span className="text-[12px]">Only outgoing (debit) transactions are imported as expenses.</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] text-[var(--text-soft)]">
                {candidates.length} debit transaction{candidates.length === 1 ? '' : 's'} found
                {creditCount > 0 && ` (${creditCount} credit${creditCount === 1 ? '' : 's'} skipped — income is tracked separately)`}
                . {selectedRows.length} selected to import.
              </p>
              <div className="flex items-center gap-3 text-[12.5px] font-medium text-[var(--primary)]">
                <button
                  onClick={selectAll}
                  title="Leaves rows flagged as already imported unchecked"
                  className="hover:underline"
                >
                  Select all
                </button>
                <button onClick={deselectAll} className="hover:underline">
                  Deselect all
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto rounded-lg border border-[var(--border-soft)]">
              <table className="w-full text-left text-[12.5px]">
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.key} className="border-b border-[var(--border-soft)] last:border-0">
                      <td className="w-8 px-3 py-2">
                        <input type="checkbox" checked={c.selected} onChange={() => toggle(c.key)} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-[var(--text-soft)]">{formatDate(c.date)}</td>
                      <td className="px-2 py-2 text-[var(--ink)]">
                        {c.merchant}
                        {c.duplicate && (
                          <span className="ml-1.5 text-[11px] italic text-[var(--text-soft)]">already imported?</span>
                        )}
                        {!c.duplicate && c.possibleDuplicate && (
                          <span className="ml-1.5 text-[11px] italic text-[var(--warn)]">
                            possible duplicate (same date &amp; amount)
                          </span>
                        )}
                        {c.isLikelyTransfer && (
                          <span className="ml-1.5 text-[11px] italic text-[var(--text-soft)]">transfer</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[var(--ink)]">
                        {formatMoney(c.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={selectedRows.length === 0 || isImportingTransactions}
                className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {isImportingTransactions
                  ? 'Importing…'
                  : `Import ${selectedRows.length} transaction${selectedRows.length === 1 ? '' : 's'}`}
              </button>
              <button
                onClick={() => {
                  setCandidates(null)
                  setFileName(null)
                }}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
              >
                Choose different file
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-[13px] text-[var(--warn)]">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </Card>
    </div>
  )
}
