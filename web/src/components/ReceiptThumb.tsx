import { Receipt } from 'lucide-react'

export function ReceiptThumb({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-md"
      style={{ width: size, height: size, background: `${color}14`, color }}
    >
      <Receipt size={size * 0.45} strokeWidth={1.75} />
    </div>
  )
}
