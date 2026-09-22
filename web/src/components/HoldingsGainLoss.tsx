import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Holding } from '../data/selectors'
import { formatMoney, formatMoneyCompact } from '../utils/format'

// formatMoneyCompact only shortens amounts >= $1,000 — below that it falls back to full
// currency with cents, which is too wide for a Y-axis tick label. Gain/loss on a single
// holding is usually well under $1,000, so axis ticks round to whole dollars instead.
const formatAxisMoney = (amount: number): string =>
  Math.abs(amount) >= 1000 ? formatMoneyCompact(amount) : `${amount < 0 ? '-' : ''}$${Math.round(Math.abs(amount))}`

interface HoldingRow extends Holding {
  priceNow: number | null
  value: number | null
  gain: number | null
}

interface Props {
  holdings: Holding[]
  prices: Record<string, number>
}

// A diverging bar per holding: gain/loss is a delta above or below a zero baseline,
// so it gets its own axis rather than sharing one with qty/price/market value —
// those are surfaced in the tooltip instead, since mixing units on one axis is the
// #1 charting mistake (a $400 market value and a 3-share quantity can't share a scale).
export function HoldingsGainLoss({ holdings, prices }: Props) {
  const rows: HoldingRow[] = holdings
    .map((h) => {
      const priceNow = prices[h.symbol] ?? null
      const value = priceNow != null ? priceNow * h.quantity : null
      const gain = value != null ? value - h.costBasis : null
      return { ...h, priceNow, value, gain }
    })
    .filter((r) => r.gain != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  if (rows.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center text-center text-[13px] text-[var(--text-soft)]">
        No priced holdings yet — click "Price now" to chart gain/loss.
      </div>
    )
  }

  return (
    <div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="symbol"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-soft)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={48}
              tick={{ fontSize: 11, fill: 'var(--text-soft)' }}
              tickFormatter={(v) => formatAxisMoney(Number(v))}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip content={<HoldingTooltip />} cursor={{ fill: 'var(--paper)' }} />
            <Bar dataKey="gain" shape={<GainLossBar />} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[12px] text-[var(--text-soft)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--primary)' }} />
          Gain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--warn)' }} />
          Loss
        </span>
      </div>
    </div>
  )
}

// Rounded at the data end (away from the zero baseline), square where the bar meets
// the baseline — a positive bar rounds on top, a negative one rounds on the bottom.
function GainLossBar(props: unknown) {
  const { x, y, width, height, payload } = props as {
    x: number
    y: number
    width: number
    height: number
    payload: HoldingRow
  }
  const isGain = (payload.gain ?? 0) >= 0
  const fill = isGain ? 'var(--primary)' : 'var(--warn)'
  const r = Math.min(4, height, width / 2)
  const path = isGain
    ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
    : `M${x},${y} L${x + width},${y} L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} L${x + r},${y + height} Q${x},${y + height} ${x},${y + height - r} Z`
  return <path d={path} fill={fill} />
}

function HoldingTooltip({ active, payload }: { active?: boolean; payload?: { payload: HoldingRow }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const h = payload[0].payload
  const gainPct = h.gain != null && h.costBasis > 0 ? (h.gain / h.costBasis) * 100 : null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] shadow-sm">
      <p className="mb-1 font-semibold text-[var(--ink)]">{h.symbol}</p>
      <dl className="space-y-0.5">
        <Row label="Qty" value={String(h.quantity)} />
        <Row label="Price now" value={h.priceNow != null ? formatMoney(h.priceNow) : '—'} />
        <Row label="Market value" value={h.value != null ? formatMoney(h.value) : '—'} />
        <Row
          label="Gain/loss"
          value={
            h.gain != null
              ? `${h.gain >= 0 ? '+' : ''}${formatMoney(h.gain)}${gainPct != null ? ` (${gainPct.toFixed(1)}%)` : ''}`
              : '—'
          }
          tone={h.gain == null ? undefined : h.gain >= 0 ? 'good' : 'warn'}
        />
      </dl>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--text-soft)]">{label}</dt>
      <dd
        className={`font-mono ${tone === 'good' ? 'text-[var(--primary)]' : tone === 'warn' ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}`}
      >
        {value}
      </dd>
    </div>
  )
}
