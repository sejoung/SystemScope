import { useRef, useState, useEffect } from 'react'

export function useContainerWidth(defaultWidth: number = 400): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(defaultWidth)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const initialWidth = el.clientWidth || defaultWidth
    setWidth((prev) => (prev === initialWidth ? prev : initialWidth))

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) {
        setWidth((prev) => (prev === w ? prev : w))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [defaultWidth])

  return [ref, width]
}
