import { useCallback, useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 150

/**
 * IntersectionObserver 기반으로 화면에 보이는 항목 ID를 추적한다.
 * - visibleIdsRef: 현재 보이는 ID Set (ref — 읽기 전용, re-render 유발 안 함)
 * - visibilityTrigger: 새 pending 항목이 visible 될 때 증가하는 카운터
 * - observeRow(id): <tr ref={observeRow(id)}> 형태로 사용
 */
export function useVisibleIds(pendingIds: Set<string>) {
  const visibleIdsRef = useRef<Set<string>>(new Set())
  const [visibilityTrigger, setVisibilityTrigger] = useState(0)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementMapRef = useRef<Map<string, Element>>(new Map())
  const pendingIdsRef = useRef(pendingIds)
  pendingIdsRef.current = pendingIds
  const debounceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let hasNewVisiblePending = false

        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.observeId
          if (!id) continue

          if (entry.isIntersecting) {
            const wasNew = !visibleIdsRef.current.has(id)
            visibleIdsRef.current.add(id)
            if (wasNew && pendingIdsRef.current.has(id)) {
              hasNewVisiblePending = true
            }
          } else {
            visibleIdsRef.current.delete(id)
          }
        }

        if (hasNewVisiblePending) {
          if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current)
          }
          debounceTimerRef.current = window.setTimeout(() => {
            debounceTimerRef.current = null
            setVisibilityTrigger((v) => v + 1)
          }, DEBOUNCE_MS)
        }
      },
      { rootMargin: '200px 0px' }
    )

    observerRef.current = observer

    for (const [, el] of elementMapRef.current) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const observeRow = useCallback((id: string) => {
    return (el: HTMLTableRowElement | null) => {
      const prev = elementMapRef.current.get(id)
      if (prev) {
        observerRef.current?.unobserve(prev)
        elementMapRef.current.delete(id)
      }

      if (el) {
        el.dataset.observeId = id
        elementMapRef.current.set(id, el)
        observerRef.current?.observe(el)
      }
    }
  }, [])

  return { visibleIdsRef, visibilityTrigger, observeRow }
}
