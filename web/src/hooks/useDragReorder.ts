import { useRef, useState } from 'react'

// A pointer-events-based drag-to-reorder, used in place of the HTML5 native drag API
// (`draggable`/onDragStart/onDrop) — that API is notoriously unreliable across browsers
// (it can silently fail to engage from a mousedown-and-move gesture) and doesn't work at
// all on touch screens. Pointer events unify mouse, touch, and pen under one API and, with
// pointer capture, keep receiving move/up events on the handle even once the pointer
// leaves its bounds — no window-level listeners needed.
//
// While dragging, the item closest to the pointer's Y position swaps into the dragged
// item's slot, giving live visual reordering; releasing commits the final order.
export function useDragReorder<T extends { id: string }>(items: T[], onCommit: (orderedIds: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null)
  const draggingId = useRef<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())

  const displayIds = order ?? items.map((i) => i.id)
  const displayItems = displayIds.map((id) => items.find((i) => i.id === id)).filter((i): i is T => i != null)

  const registerRef = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  const handlePointerDown = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    draggingId.current = id
    setOrder(items.map((i) => i.id))
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggingId.current) return
    const current = order ?? items.map((i) => i.id)
    let closestId: string | null = null
    let closestDist = Infinity
    for (const [id, el] of itemRefs.current) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(mid - e.clientY)
      if (dist < closestDist) {
        closestDist = dist
        closestId = id
      }
    }
    if (closestId && closestId !== draggingId.current) {
      const from = current.indexOf(draggingId.current)
      const to = current.indexOf(closestId)
      if (from !== -1 && to !== -1 && from !== to) {
        const next = [...current]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        setOrder(next)
      }
    }
  }

  const handlePointerUp = () => {
    if (draggingId.current && order) onCommit(order)
    draggingId.current = null
    setOrder(null)
  }

  return {
    displayItems,
    isDragging: (id: string) => draggingId.current === id,
    registerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
