import { useEffect } from 'react'

type CleanupFn = () => void
type ListenerFn = (callback: (data: unknown) => void) => CleanupFn

export function useIpcListener(listener: ListenerFn, callback: (data: unknown) => void): void {
  useEffect(() => {
    const cleanup = listener(callback)
    return cleanup
  }, [listener, callback])
}
