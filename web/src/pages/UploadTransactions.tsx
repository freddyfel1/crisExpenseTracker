import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useStore } from '../data/store'
import { looksLikeBinarySpreadsheet, parseBankCsv, type ParsedCsvRow } from '../utils/parseBankCsv'
import { formatDate, formatMoney } from '../utils/format'
import { Card } from '../components/Card'

const selectClass =
  'mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-[13px] text-[var(--ink)]'

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

  // Set when auto-detection can't recognize the date/description/amount columns —
  // the raw text is kept around so we can re-parse it once the user maps columns.
  const [rawText, setRawText] = useState<string | null>(null)
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[] | null>(null)
  const [mapDate, setMapDate] = useState('')
  const [mapDesc, setMapDesc] = useState('')
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single')
  const [mapAmount, setMapAmount] = useState('')
  const [mapDebit, setMapDebit] = useState('')
  const [mapCredit, setMapCredit] = useState('')

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

  const resetMapping = () => {
    setRawText(null)
    setUnmappedHeaders(null)
    setMapDate('')
    setMapDesc('')
    setAmountMode('single')
    setMapAmount('')
    setMapDebit('')
    setMapCredit('')
  }

  const applyParsedRows = (rows: ParsedCsvRow[], credits: number) => {
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

  const handleFile = async (file: File) => {
    setError(null)
    setImported(null)
    setFileName(file.name)
    resetMapping()

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
    const result = parseBankCsv(text)
    if (result.headers) {
      // Auto-detection couldn't recognize the columns — let the user map them by hand
      // instead of just rejecting the file.
      setRawText(text)
      setUnmappedHeaders(result.headers)
      setCandidates(null)
      return
    }
    if (result.rows.length === 0) {
      setError(
        "No debit transactions found in that file — every row was either a credit/deposit, a transfer, " +
          "or couldn't be read.",
      )
      setCandidates(null)
      return
    }
    applyParsedRows(result.rows, result.creditCount)
  }

  const mappingComplete =
    mapDate !== '' && mapDesc !== '' && (amountMode === 'single' ? mapAmount !== '' : mapDebit !== '' || mapCredit !== '')

  const handleApplyMapping = () => {
    if (!rawText || !unmappedHeaders || !mappingComplete) return
    const idx = (name: string) => unmappedHeaders.indexOf(name)
    const result = parseBankCsv(rawText, {
      dateCol: idx(mapDate),
      descCol: idx(mapDesc),
      amountCol: amountMode === 'single' ? idx(mapAmount) : undefined,
      debitCol: amountMode === 'split' && mapDebit ? idx(mapDebit) : undefined,
      creditCol: amountMode === 'split' && mapCredit ? idx(mapCredit) : undefined,
    })
    if (result.rows.length === 0) {
      setError("Still couldn't find any debit transactions with those columns — double check your selections.")
      return
    }
    setError(null)
    resetMapping()
    applyParsedRows(result.rows, result.creditCount)
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
          shared with any third party, and you choose exactly which transactions get imported. Comma-,
          semicolon-, and tab-delimited files from any bank are supported; if the columns can't be
          recognized automatically, you'll be able to match them up by hand. If your bank's download only
          offers "Excel", pick the CSV / comma-delimited option in that dialog, or open the download in
          Excel and use Save As → CSV.
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

        {unmappedHeaders ? (
          <div className="space-y-4">
            <p className="text-[13px] text-[var(--text-soft)]">
              We couldn't automatically recognize the date, description, or amount columns in{' '}
              <span className="font-medium text-[var(--ink)]">{fileName}</span>. Match them up below.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-[12.5px] font-medium text-[var(--text-soft)]">
                Date column
                <select value={mapDate} onChange={(e) => setMapDate(e.target.value)} className={selectClass}>
                  <option value="">Select…</option>
                  {unmappedHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12.5px] font-medium text-[var(--text-soft)]">
                Description column
                <select value={mapDesc} onChange={(e) => setMapDesc(e.target.value)} className={selectClass}>
                  <option value="">Select…</option>
                  {unmappedHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              <div className="flex gap-4 text-[12.5px] text-[var(--text-soft)]">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={amountMode === 'single'} onChange={() => setAmountMode('single')} />
                  One amount column
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={amountMode === 'split'} onChange={() => setAmountMode('split')} />
                  Separate debit/credit columns
                </label>
              </div>
              {amountMode === 'single' ? (
                <label className="block text-[12.5px] font-medium text-[var(--text-soft)]">
                  Amount column
                  <select value={mapAmount} onChange={(e) => setMapAmount(e.target.value)} className={selectClass}>
                    <option value="">Select…</option>
                    {unmappedHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-[12.5px] font-medium text-[var(--text-soft)]">
                    Debit / withdrawal column
                    <select value={mapDebit} onChange={(e) => setMapDebit(e.target.value)} className={selectClass}>
                      <option value="">Select…</option>
                      {unmappedHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[12.5px] font-medium text-[var(--text-soft)]">
                    Credit / deposit column (optional)
                    <select value={mapCredit} onChange={(e) => setMapCredit(e.target.value)} className={selectClass}>
                      <option value="">Select…</option>
                      {unmappedHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleApplyMapping}
                disabled={!mappingComplete}
                className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Use these columns
              </button>
              <button
                onClick={() => {
                  resetMapping()
                  setFileName(null)
                }}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
              >
                Choose different file
              </button>
            </div>
          </div>
        ) : !candidates ? (
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
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
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
