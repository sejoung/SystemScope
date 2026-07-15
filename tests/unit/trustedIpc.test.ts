import { afterEach, describe, expect, it, vi } from 'vitest'

const fromWebContentsMock = vi.hoisted(() => vi.fn())
const handleMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: fromWebContentsMock },
  ipcMain: { handle: handleMock }
}))

const { ipcMain, isTrustedIpcSender, isTrustedRendererUrl } = await import('../../src/main/ipc/_shared/trustedIpc')

afterEach(() => {
  process.env.NODE_ENV = 'test'
  vi.clearAllMocks()
})

describe('trusted IPC renderer URL', () => {
  it('accepts the packaged renderer and rejects other local or remote documents', () => {
    expect(isTrustedRendererUrl('file:///Applications/SystemScope.app/Contents/Resources/app.asar/out/renderer/index.html')).toBe(true)
    expect(isTrustedRendererUrl('file:///tmp/untrusted.html')).toBe(false)
    expect(isTrustedRendererUrl('https://example.com/renderer/index.html')).toBe(false)
  })

  it('requires the sender to belong to a live BrowserWindow outside tests', () => {
    process.env.NODE_ENV = 'production'
    const event = { sender: { getURL: () => 'file:///app/out/renderer/index.html' } }
    fromWebContentsMock.mockReturnValueOnce(null)
    expect(isTrustedIpcSender(event as never)).toBe(false)
    fromWebContentsMock.mockReturnValueOnce({ isDestroyed: () => false })
    expect(isTrustedIpcSender(event as never)).toBe(true)
  })

  it('returns a permission failure without invoking an IPC handler for an untrusted sender', async () => {
    process.env.NODE_ENV = 'production'
    fromWebContentsMock.mockReturnValue(null)
    const listener = vi.fn()
    ipcMain.handle('secure-channel', listener)
    const wrapped = handleMock.mock.calls[0][1]
    const result = await wrapped({ sender: { getURL: () => 'https://evil.example' } })
    expect(result).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } })
    expect(listener).not.toHaveBeenCalled()
  })
})
