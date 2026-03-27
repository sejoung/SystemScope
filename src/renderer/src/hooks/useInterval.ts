import { useEffect, useRef } from 'react'

export function useInterval(callback: () => void, delay: number | null, immediate = false): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return
    if (immediate) savedCallback.current()
    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay, immediate])
}
