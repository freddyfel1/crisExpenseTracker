// Parses bank-exported CSV statements (Chase's export format, and anything close
// enough to it) into candidate expense transactions. Only debits are surfaced —
// credits are income/transfers, which this app tracks separately (see monthly_income).

export interface ParsedCsvRow {
  date: string // YYYY-MM-DD
  merchant: string
  amount: number // positive
  paymentMethod: string | null
  isLikelyTransfer: boolean
}

// Detects a real binary Excel file (as opposed to CSV text, even one saved with an
// .xls/.xlsx extension) by magic bytes, so the UI can point the user at re-exporting
// as CSV instead of failing silently with "no transactions found".
export function looksLikeBinarySpreadsheet(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  // .xlsx (and .xls saved as a modern zip-based file) starts with the ZIP signature "PK\x03\x04".
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true
  // Legacy .xls (OLE Compound File) signature.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true
  return false
}

export interface ParseCsvResult {
  rows: ParsedCsvRow[]
  creditCount: number
  skippedCount: number
}

// Splits one CSV line into fields, honoring double-quoted fields that may
// contain commas (Chase wraps the Description field in quotes for this reason).
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.toLowerCase())
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate)
    if (idx !== -1) return idx
  }
  return -1
}

// Converts "MM/DD/YYYY" (what Chase and most US bank exports use) to ISO.
function toIsoDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, m, d, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const TRANSFER_TYPES = new Set(['ACCT_XFER'])

export function parseBankCsv(text: string): ParseCsvResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { rows: [], creditCount: 0, skippedCount: 0 }

  const header = splitCsvLine(lines[0])
  const dateCol = findColumn(header, ['posting date', 'date', 'transaction date'])
  const descCol = findColumn(header, ['description', 'merchant', 'payee'])
  const amountCol = findColumn(header, ['amount'])
  const typeCol = findColumn(header, ['type'])
  const detailsCol = findColumn(header, ['details'])

  if (dateCol === -1 || descCol === -1 || amountCol === -1) {
    return { rows: [], creditCount: 0, skippedCount: lines.length - 1 }
  }

  const rows: ParsedCsvRow[] = []
  let creditCount = 0
  let skippedCount = 0

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i])
    const rawAmount = Number(fields[amountCol]?.replace(/[^0-9.-]/g, ''))
    const isoDate = toIsoDate(fields[dateCol] ?? '')
    const description = fields[descCol]?.replace(/\s+/g, ' ').trim()
    const details = detailsCol !== -1 ? fields[detailsCol]?.toUpperCase() : null

    if (!isoDate || !description || Number.isNaN(rawAmount)) {
      skippedCount++
      continue
    }

    // A row counts as a debit (money out) when the Details column says so, or
    // when there's no Details column at all, when the amount itself is negative.
    const isDebit = details ? details === 'DEBIT' : rawAmount < 0
    if (!isDebit) {
      creditCount++
      continue
    }

    const type = typeCol !== -1 ? fields[typeCol]?.toUpperCase() : ''
    rows.push({
      date: isoDate,
      merchant: description,
      amount: Math.abs(rawAmount),
      paymentMethod: type || null,
      isLikelyTransfer: TRANSFER_TYPES.has(type ?? ''),
    })
  }

  return { rows, creditCount, skippedCount }
}
