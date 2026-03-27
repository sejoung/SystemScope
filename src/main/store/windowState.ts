import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BrowserWindow } from 'electron'

interface WindowState {
  width: number
  height: number
  x: number | undefined
  y: number | undefined
  isMaximized: boolean
}

const stateFile = path.join(app.getPath('userData'), 'window-state.json')

export function restoreWindowState(): WindowState | null {
  try {
    const data = fs.readFileSync(stateFile, 'utf-8')
    return JSON.parse(data) as WindowState
  } catch {
    return null
  }
}

export function saveWindowState(win: BrowserWindow): void {
  const bounds = win.getBounds()
  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: win.isMaximized()
  }
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
  } catch {
    // ignore write errors
  }
}
