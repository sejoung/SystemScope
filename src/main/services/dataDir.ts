import { app } from 'electron'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

function getDataDir(): string {
  return path.join(app.getPath('userData'), 'data')
}

async function ensureDataDir(): Promise<string> {
  const dir = getDataDir()
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

function getMetricsFilePath(): string {
  return path.join(getDataDir(), 'metrics.json')
}

function getEventsFilePath(): string {
  return path.join(getDataDir(), 'events.json')
}

export { getDataDir, ensureDataDir, getMetricsFilePath, getEventsFilePath }
