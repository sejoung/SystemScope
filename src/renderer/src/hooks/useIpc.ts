import { useEffect, useRef } from 'react'

type CleanupFn = () => void
type ListenerFn = (callback: (data: unknown) => void) => CleanupFn

export function useIpcListener(listener: ListenerFn, callback: (data: unknown) => void): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const cleanup = listener((data: unknown) => callbackRef.current(data))
    return cleanup
  }, [listener])
}
