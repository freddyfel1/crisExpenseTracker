import { useEffect, useRef, useState } from 'react'

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
  // State, not a ref: `isDragging(id)` below is read during render to apply the
  // dragged item's faded style, and a ref mutation alone doesn't schedule a
  // re-render — clearing a ref on pointer-up left that style stuck until some
  // unrelated render happened to come along and read the ref's new value.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  // registerRef must return the SAME function reference across renders for a given id —
  // a fresh closure every render makes React detach-then-reattach every item's ref on
  // every render (React treats a changed ref-callback identity as "this ref changed"),
  // churning itemRefs mid-drag right when handlePointerMove needs stable measurements.
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>())

  // The server data (`items`) only reflects a completed drag once its own mutation +
  // refetch round-trip finishes, which is never before this hook's next render. Clearing
  // `order` as soon as the pointer lifts would snap the list back to that still-stale
  // server order for a beat — or permanently, if the earlier render's revert happened to
  // race ahead of the refetch. Keeping the optimistic order until the server's own order
  // matches it means the reordered position sticks the instant you let go, without a
  // visible (or real) revert.
  useEffect(() => {
    if (order && items.length === order.length && items.every((item, i) => item.id === order[i])) {
      setOrder(null)
    }
  }, [items, order])

  const displayIds = order ?? items.map((i) => i.id)
  const displayItems = displayIds.map((id) => items.find((i) => i.id === id)).filter((i): i is T => i != null)

  const registerRef = (id: string) => {
    let cb = refCallbacks.current.get(id)
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) itemRefs.current.set(id, el)
        else itemRefs.current.delete(id)
      }
      refCallbacks.current.set(id, cb)
    }
    return cb
  }

  const handlePointerDown = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    setDraggingId(id)
    setOrder(items.map((i) => i.id))
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggingId) return
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
    if (closestId && closestId !== draggingId) {
      const from = current.indexOf(draggingId)
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
    if (draggingId && order) onCommit(order)
    setDraggingId(null)
    // `order` is deliberately left as-is here — see the effect above.
  }

  return {
    displayItems,
    isDragging: (id: string) => draggingId === id,
    registerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
