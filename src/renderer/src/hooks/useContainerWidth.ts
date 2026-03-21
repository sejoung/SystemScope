import { useRef, useState, useEffect } from 'react'

export function useContainerWidth(defaultWidth: number = 400): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(defaultWidth)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    setWidth(el.clientWidth || defaultWidth)

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [defaultWidth])

  return [ref, width]
}
