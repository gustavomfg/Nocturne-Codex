import { useEffect, useRef, type RefObject } from 'react'

const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

interface OffCanvasPanelOptions {
  open: boolean
  modal: boolean
  onClose(): void
  triggerRef: RefObject<HTMLElement>
}

export function useOffCanvasPanel<T extends HTMLElement>({ open, modal, onClose, triggerRef }: OffCanvasPanelOptions): RefObject<T> {
  const panelRef = useRef<T>(null)
  const closeRef = useRef(onClose)
  const wasModalOpenRef = useRef(false)
  closeRef.current = onClose

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !open || !modal) return
    const focusPanel = window.requestAnimationFrame(() => {
      panel.querySelector<HTMLElement>(focusableSelector)?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => item.offsetParent !== null)
      if (!controls.length) { event.preventDefault(); panel.focus(); return }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusPanel)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [modal, open, triggerRef])

  useEffect(() => {
    const wasModalOpen = wasModalOpenRef.current
    wasModalOpenRef.current = open && modal
    if (wasModalOpen && (!open || !modal)) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [modal, open, triggerRef])

  return panelRef
}
