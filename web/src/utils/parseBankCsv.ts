// Parses bank-exported CSV/TSV statements from any bank into candidate expense
// transactions. Only debits are surfaced — credits are income/transfers, which this
// app tracks separately (see monthly_income). Column names, delimiters, and date
// formats vary a lot between banks, so this auto-detects what it can and falls back
// to letting the caller supply an explicit column mapping (see ManualColumnMapping)
// when it can't.

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
  // Present only when columns couldn't be auto-detected — the caller can show these
  // to the user and re-parse with an explicit ManualColumnMapping.
  headers?: string[]
}

// An explicit column assignment, used when auto-detection fails. Indices are into
// the header row returned in ParseCsvResult.headers. Either amountCol, or one/both
// of debitCol/creditCol, must be provided.
export interface ManualColumnMapping {
  dateCol: number
  descCol: number
  amountCol?: number
  debitCol?: number
  creditCol?: number
  typeCol?: number
  detailsCol?: number
}

const DELIMITER_CANDIDATES = [',', ';', '\t', '|']

// Bank exports use commas, semicolons (common outside the US), or tabs. Pick
// whichever delimiter actually splits the header into more than one field.
function detectDelimiter(headerLine: string): string {
  let best = ','
  let bestCount = 0
  for (const d of DELIMITER_CANDIDATES) {
    const count = headerLine.split(d).length - 1
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

// Splits one delimited line into fields, honoring double-quoted fields that may
// contain the delimiter itself.
function splitLine(line: string, delimiter: string): string[] {
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
    } else if (ch === delimiter) {
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
  const lower = header.map((h) => h.toLowerCase().trim())
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate)
    if (idx !== -1) return idx
  }
  return -1
}

const DATE_CANDIDATES = [
  'posting date',
  'post date',
  'date',
  'transaction date',
  'trans date',
  'value date',
  'effective date',
]
const DESC_CANDIDATES = [
  'description',
  'merchant',
  'payee',
  'narrative',
  'memo',
  'particulars',
  'transaction description',
  'name',
]
const AMOUNT_CANDIDATES = ['amount', 'transaction amount', 'value']
const DEBIT_CANDIDATES = ['debit', 'withdrawal', 'debit amount', 'money out', 'paid out', 'withdrawals']
const CREDIT_CANDIDATES = ['credit', 'deposit', 'credit amount', 'money in', 'paid in', 'deposits']
const TYPE_CANDIDATES = ['type', 'transaction type', 'category']
const DETAILS_CANDIDATES = ['details']

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// For an ambiguous numeric date (both parts <= 12) resolves which is the month
// and which is the day, using dayFirst as the tie-breaker when the file's own
// convention couldn't be inferred from another row. Returns null if neither
// order is a valid month.
function resolveMonthDay(a: number, b: number, dayFirst: boolean): [number, number] | null {
  if (a > 12 && b > 12) return null
  if (a > 12) return [b, a]
  if (b > 12) return [a, b]
  return dayFirst ? [b, a] : [a, b]
}

// Accepts the wide variety of date formats banks actually export: ISO
// (2026-09-05), US slash (09/05/2026), day-first slash (05/09/2026), two-digit
// years, dash-separated, and month-name formats (Sep 5, 2026 / 5 Sep 2026 /
// 05-Sep-2026). Any trailing time-of-day component is stripped first. When both
// the day and month are <= 12 the order is genuinely ambiguous from a single
// value — dayFirst (inferred elsewhere from the rest of the column) breaks the tie.
function toIsoDate(raw: string, dayFirst: boolean): string | null {
  const value = raw
    .trim()
    .replace(/[tT]\d{1,2}:\d{2}.*$/, '')
    .replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?$/, '')
    .trim()
  if (!value) return null

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  let m = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    return isValidDate(+y, +mo, +d) ? toIso(+y, +mo, +d) : null
  }

  // Numeric with 4-digit year: MM/DD/YYYY or DD/MM/YYYY (either / or -).
  m = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const [, a, b, y] = m
    const resolved = resolveMonthDay(+a, +b, dayFirst)
    if (!resolved) return null
    const [month, day] = resolved
    return isValidDate(+y, month, day) ? toIso(+y, month, day) : null
  }

  // Numeric with 2-digit year.
  m = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/)
  if (m) {
    const [, a, b, yy] = m
    const resolved = resolveMonthDay(+a, +b, dayFirst)
    if (!resolved) return null
    const [month, day] = resolved
    const year = 2000 + +yy
    return isValidDate(year, month, day) ? toIso(year, month, day) : null
  }

  // Month-name formats: "Sep 5, 2026", "September 5 2026".
  m = value.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()]
    return mon && isValidDate(+m[3], mon, +m[2]) ? toIso(+m[3], mon, +m[2]) : null
  }

  // Month-name formats: "5 Sep 2026", "05-Sep-2026".
  m = value.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s-]+(\d{4})$/)
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    return mon && isValidDate(+m[3], mon, +m[1]) ? toIso(+m[3], mon, +m[1]) : null
  }

  return null
}

// Parses a currency-formatted amount, handling both US (1,234.56) and European
// (1.234,56 or plain 45,20) comma/dot conventions, currency symbols, and
// accounting-style parentheses (e.g. "(12.34)") for negative amounts.
function parseAmount(raw: string | undefined): number | null {
  if (raw == null) return null
  let s = raw.trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[^0-9.,-]/g, '')
  if (!s) return null
  if (s.startsWith('-')) negative = true
  s = s.replace(/-/g, '')

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Only commas: a single comma with 1-2 trailing digits is a decimal
    // separator (European style); anything else is a thousands separator.
    const parts = s.split(',')
    s = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2 ? parts.join('.') : parts.join('')
  }

  if (!s) return null
  const n = Number(s)
  if (Number.isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}

// Numeric slash/dash dates are ambiguous (05/09/2026 could be May 9 or Sep 5)
// when both parts are <= 12. Scans the whole date column for a row where one
// part is unambiguously > 12 to infer the file's day-first vs month-first
// convention, rather than always assuming US (month-first) order.
function detectDayFirst(lines: string[], delimiter: string, dateCol: number): boolean {
  for (let i = 1; i < lines.length; i++) {
    const value = splitLine(lines[i], delimiter)[dateCol]?.trim()
    if (!value) continue
    const m = value.match(/^(\d{1,2})[-/](\d{1,2})[-/]\d{2,4}$/)
    if (!m) continue
    const a = +m[1]
    const b = +m[2]
    if (a > 12 && b <= 12) return true
    if (b > 12 && a <= 12) return false
  }
  return false
}

const TRANSFER_TYPES = new Set(['ACCT_XFER', 'TRANSFER'])
const DEBIT_INDICATORS = new Set(['DEBIT', 'WITHDRAWAL', 'DR'])
const CREDIT_INDICATORS = new Set(['CREDIT', 'DEPOSIT', 'CR'])

// When a single Amount column holds only positive numbers, some banks put the
// sign information in a separate label column instead — but name it inconsistently
// (a column literally named "Debit" containing the text "Debit"/"Credit" per row,
// rather than a debit amount). Column-name matching alone misses this, so this
// scans every other column's actual values: whichever one consists entirely of
// DEBIT_INDICATORS/CREDIT_INDICATORS values (checked against a sample of rows) is
// almost certainly the real sign indicator, whatever it's called.
function findIndicatorColumn(lines: string[], delimiter: string, columnCount: number, excludeCols: number[]): number {
  const sampleSize = Math.min(lines.length - 1, 30)
  for (let col = 0; col < columnCount; col++) {
    if (excludeCols.includes(col)) continue
    let seen = 0
    let matched = 0
    for (let i = 1; i <= sampleSize; i++) {
      const value = splitLine(lines[i], delimiter)[col]?.trim().toUpperCase()
      if (!value) continue
      seen++
      if (DEBIT_INDICATORS.has(value) || CREDIT_INDICATORS.has(value)) matched++
    }
    if (seen > 0 && matched === seen) return col
  }
  return -1
}

export function parseBankCsv(text: string, manualMapping?: ManualColumnMapping): ParseCsvResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { rows: [], creditCount: 0, skippedCount: 0 }

  const delimiter = detectDelimiter(lines[0])
  const header = splitLine(lines[0], delimiter)

  let dateCol: number
  let descCol: number
  let amountCol: number
  let debitCol: number
  let creditCol: number
  let typeCol: number
  let detailsCol: number

  if (manualMapping) {
    dateCol = manualMapping.dateCol
    descCol = manualMapping.descCol
    amountCol = manualMapping.amountCol ?? -1
    debitCol = manualMapping.debitCol ?? -1
    creditCol = manualMapping.creditCol ?? -1
    typeCol = manualMapping.typeCol ?? -1
    detailsCol = manualMapping.detailsCol ?? -1
  } else {
    dateCol = findColumn(header, DATE_CANDIDATES)
    descCol = findColumn(header, DESC_CANDIDATES)
    amountCol = findColumn(header, AMOUNT_CANDIDATES)
    debitCol = findColumn(header, DEBIT_CANDIDATES)
    creditCol = findColumn(header, CREDIT_CANDIDATES)
    typeCol = findColumn(header, TYPE_CANDIDATES)
    detailsCol = findColumn(header, DETAILS_CANDIDATES)

    // Amount and debit/credit candidates can collide (e.g. a "Credit" header also
    // reads as a debit/credit split column) — prefer the split columns only when
    // there's no single combined amount column.
    if (amountCol !== -1) {
      debitCol = -1
      creditCol = -1
    }

    if (dateCol === -1 || descCol === -1 || (amountCol === -1 && debitCol === -1 && creditCol === -1)) {
      return { rows: [], creditCount: 0, skippedCount: lines.length - 1, headers: header }
    }
  }

  const dayFirst = detectDayFirst(lines, delimiter, dateCol)
  const indicatorCol =
    amountCol !== -1 ? findIndicatorColumn(lines, delimiter, header.length, [dateCol, descCol, amountCol]) : -1
  const rows: ParsedCsvRow[] = []
  let creditCount = 0
  let skippedCount = 0

  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i], delimiter)
    const isoDate = toIsoDate(fields[dateCol] ?? '', dayFirst)
    const description = fields[descCol]?.replace(/\s+/g, ' ').trim()

    if (!isoDate || !description) {
      skippedCount++
      continue
    }

    let rawAmount: number | null
    let isDebit: boolean

    if (debitCol !== -1 || creditCol !== -1) {
      const debitVal = debitCol !== -1 ? parseAmount(fields[debitCol]) : null
      const creditVal = creditCol !== -1 ? parseAmount(fields[creditCol]) : null
      if (debitVal !== null && debitVal !== 0) {
        rawAmount = debitVal
        isDebit = true
      } else if (creditVal !== null && creditVal !== 0) {
        rawAmount = creditVal
        isDebit = false
      } else {
        skippedCount++
        continue
      }
    } else {
      rawAmount = parseAmount(fields[amountCol])
      if (rawAmount === null) {
        skippedCount++
        continue
      }
      const indicatorSource =
        indicatorCol !== -1 ? fields[indicatorCol] : detailsCol !== -1 ? fields[detailsCol] : typeCol !== -1 ? fields[typeCol] : ''
      const indicator = indicatorSource?.toUpperCase().trim()
      if (indicator && DEBIT_INDICATORS.has(indicator)) isDebit = true
      else if (indicator && CREDIT_INDICATORS.has(indicator)) isDebit = false
      else isDebit = rawAmount < 0
    }

    if (!isDebit) {
      creditCount++
      continue
    }

    const type = typeCol !== -1 ? fields[typeCol]?.toUpperCase().trim() : ''
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
