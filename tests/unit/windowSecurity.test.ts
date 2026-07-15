import { describe, expect, it, vi } from 'vitest'
import { secureRendererWindow } from '../../src/main/app/windowSecurity'

describe('secureRendererWindow', () => {
  it('denies child windows and prevents navigation away from the renderer document', () => {
    const listeners = new Map<string, (...args: never[]) => void>()
    const webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn((name: string, listener: (...args: never[]) => void) => listeners.set(name, listener))
    }
    secureRendererWindow({ webContents } as never, 'file:///app/out/renderer/index.html')

    expect(webContents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' })
    const allowedEvent = { preventDefault: vi.fn() }
    listeners.get('will-navigate')?.(allowedEvent as never, 'file:///app/out/renderer/index.html?window=about' as never)
    expect(allowedEvent.preventDefault).not.toHaveBeenCalled()

    const blockedEvent = { preventDefault: vi.fn() }
    listeners.get('will-redirect')?.(blockedEvent as never, 'https://example.com/' as never)
    expect(blockedEvent.preventDefault).toHaveBeenCalledOnce()
  })
})
