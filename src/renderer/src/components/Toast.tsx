import { useEffect, useState } from 'react'
import { create } from 'zustand'

interface ToastMessage {
  id: string
  text: string
}

interface ToastState {
  message: ToastMessage | null
  show: (message: string) => void
  hide: () => void
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) =>
    set({
      message: {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        text: message
      }
    }),
  hide: () => set({ message: null })
}))

export function ToastContainer() {
  const message = useToast((s) => s.message)
  const hide = useToast((s) => s.hide)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return

    setVisible(true)
    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, 3000)
    const clearTimer = setTimeout(() => {
      hide()
    }, 3300)

    return () => {
      clearTimeout(hideTimer)
      clearTimeout(clearTimer)
    }
  }, [message, hide])

  if (!message) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s ease',
      padding: '10px 20px',
      borderRadius: 'var(--radius)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      fontSize: '13px',
      color: 'var(--text-primary)',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {message.text}
    </div>
  )
}
