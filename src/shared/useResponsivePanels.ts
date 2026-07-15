import { useEffect, useRef, useState } from 'react'

export function useResponsivePanels() {
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 980)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 980)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 980px)').matches)
  const desktopPanelsRef = useRef({ sidebar: true, inspector: true })

  const setSidebarVisibility = (open: boolean) => {
    if (compact) { if (open) setInspectorOpen(false) }
    else desktopPanelsRef.current.sidebar = open
    setSidebarOpen(open)
  }

  const setInspectorVisibility = (open: boolean) => {
    if (compact) { if (open) setSidebarOpen(false) }
    else desktopPanelsRef.current.inspector = open
    setInspectorOpen(open)
  }

  useEffect(() => {
    const query = window.matchMedia('(max-width: 980px)')
    const synchronizeLayout = (nextCompact: boolean) => {
      setCompact(nextCompact)
      if (nextCompact) setInspectorOpen(false)
      else {
        setSidebarOpen(desktopPanelsRef.current.sidebar)
        setInspectorOpen(desktopPanelsRef.current.inspector)
      }
    }
    synchronizeLayout(query.matches)
    const onChange = (event: MediaQueryListEvent) => synchronizeLayout(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return { compact, inspectorOpen, sidebarOpen, setInspectorVisibility, setSidebarVisibility }
}
