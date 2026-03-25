import { useCallback, useRef, useState } from 'react'

type RefreshFn = () => Promise<void>

export function useTabRefresh<T extends string>(tabs: Record<T, RefreshFn>) {
  const [loading, setLoading] = useState(true)
  const [refreshingTab, setRefreshingTab] = useState<T | null>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const refresh = useCallback(async (tab: T, mode: 'initial' | 'inline' = 'inline') => {
    if (mode === 'initial') {
      setLoading(true)
    } else {
      setRefreshingTab(tab)
    }

    try {
      await tabsRef.current[tab]()
    } finally {
      if (mode === 'initial') {
        setLoading(false)
      } else {
        setRefreshingTab((current) => (current === tab ? null : current))
      }
    }
  }, [])

  return { loading, refreshingTab, refresh } as const
}
