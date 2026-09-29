import { useEffect, useRef, useState } from 'react'

// A pointer-events-based drag-to-reorder, used in place of the HTML5 native drag API
// (`draggable`/onDragStart/onDrop) — that API is notoriously unreliable across browsers
// (it can silently fail to engage from a mousedown-and-move gesture) and doesn't work at
// all on touch screens. Pointer events unify mouse, touch, and pen.
//
// Move/up tracking happens via WINDOW-level listeners rather than pointer capture on the
// grip handle. Capture is bound to a DOM node, and mid-drag that very node is the one
// getting reordered — React moves it around the list on every step. A move can drop
// capture (or the corresponding pointerup can land on a different element than expected)
// depending on the browser, silently leaving `draggingId` set forever with no pointerup
// ever firing to clear it — the item then stays stuck at its faded "dragging" opacity
// until something unrelated forces a re-render. Listening on `window` instead means the
// listener's target never moves or unmounts, so it can't lose the events it needs.
//
// While dragging, the item closest to the pointer's Y position swaps into the dragged
// item's slot, giving live visual reordering; releasing (or a cancelled gesture) commits
// the final order.
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
  // churning itemRefs mid-drag right when the move handler needs stable measurements.
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>())

  // Kept current in refs so the window listeners (attached once per drag, see below)
  // always see the latest values without needing to tear down and re-attach on every
  // reorder step. Synced from an effect, not written during render, so render stays a
  // pure function of props/state.
  const itemsRef = useRef(items)
  const orderRef = useRef(order)
  const draggingIdRef = useRef(draggingId)
  const onCommitRef = useRef(onCommit)
  useEffect(() => {
    itemsRef.current = items
    orderRef.current = order
    draggingIdRef.current = draggingId
    onCommitRef.current = onCommit
  })

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
    setOrder(itemsRef.current.map((i) => i.id))
  }

  useEffect(() => {
    if (!draggingId) return

    const reorderTo = (clientY: number) => {
      const id = draggingIdRef.current
      if (!id) return
      const current = orderRef.current ?? itemsRef.current.map((i) => i.id)
      let closestId: string | null = null
      let closestDist = Infinity
      for (const [itemId, el] of itemRefs.current) {
        const rect = el.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const dist = Math.abs(mid - clientY)
        if (dist < closestDist) {
          closestDist = dist
          closestId = itemId
        }
      }
      if (closestId && closestId !== id) {
        const from = current.indexOf(id)
        const to = current.indexOf(closestId)
        if (from !== -1 && to !== -1 && from !== to) {
          const next = [...current]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          setOrder(next)
        }
      }
    }

    const onMove = (e: PointerEvent) => reorderTo(e.clientY)
    const onRelease = () => {
      const finalOrder = orderRef.current
      if (draggingIdRef.current && finalOrder) onCommitRef.current(finalOrder)
      setDraggingId(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onRelease)
    window.addEventListener('pointercancel', onRelease)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onRelease)
      window.removeEventListener('pointercancel', onRelease)
    }
  }, [draggingId])

  return {
    displayItems,
    isDragging: (id: string) => draggingId === id,
    registerRef,
    handlePointerDown,
  }
}
