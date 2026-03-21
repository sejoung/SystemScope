import { useEffect, useState } from 'react'
import { create } from 'zustand'

interface ToastState {
  message: string | null
  show: (message: string) => void
  hide: () => void
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null })
}))

export function ToastContainer() {
  const message = useToast((s) => s.message)
  const hide = useToast((s) => s.hide)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(hide, 300) // fade out 후 제거
      }, 3000)
      return () => clearTimeout(timer)
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
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      fontSize: '13px',
      color: 'var(--text-primary)',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      {message}
    </div>
  )
}
