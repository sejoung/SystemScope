import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AIUsageDetectedProvider, AIUsageModelUsage, AIUsageOverview, AIUsageWindow } from '@shared/types'

type CodexTokenEvent = {
  total_token_usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
  model_context_window?: number
}

type CodexRateLimits = {
  plan_type?: string | null
  primary?: {
    used_percent?: number
    resets_at?: number
  }
  secondary?: {
    used_percent?: number
    resets_at?: number
  }
}

type ClaudeProjectEntry = {
  timestamp?: string
  message?: {
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    model?: string
  }
}

export async function getAIUsageOverview(): Promise<AIUsageOverview> {
  const providers = await Promise.all([
    getCodexUsage(),
    getClaudeUsage()
  ])

  return {
    providers,
    scannedAt: Date.now()
  }
}

async function getCodexUsage(): Promise<AIUsageDetectedProvider> {
  const sessionsDir = path.join(os.homedir(), '.codex', 'sessions')
  const latestFile = await findLatestFile(sessionsDir, '.jsonl')
  const installed = await fileExists('/opt/homebrew/bin/codex')

  if (!latestFile) {
    return emptyProvider('codex', 'Codex', installed)
  }

  const content = await fs.readFile(latestFile, 'utf8')
  const lines = content.split('\n')
  let lastEvent: { timestamp: string | null; info: CodexTokenEvent; rateLimits: CodexRateLimits } | null = null

  for (const line of lines) {
    if (!line.trim()) continue

    try {
      const parsed = JSON.parse(line) as {
        timestamp?: string
        type?: string
        payload?: {
          type?: string
          info?: CodexTokenEvent
          rate_limits?: CodexRateLimits
        }
      }

      if (parsed.type !== 'event_msg' || parsed.payload?.type !== 'token_count') continue
      lastEvent = {
        timestamp: parsed.timestamp ?? null,
        info: parsed.payload.info ?? {},
        rateLimits: parsed.payload.rate_limits ?? {}
      }
    } catch {
      continue
    }
  }

  return {
    id: 'codex',
    tool: 'codex',
    label: 'Codex',
    installed,
    sourcePath: latestFile,
    detectedAt: Date.now(),
    lastUpdatedAt: lastEvent?.timestamp ? Date.parse(lastEvent.timestamp) : null,
    planType: lastEvent?.rateLimits.plan_type ?? null,
    totalTokens: lastEvent?.info.total_token_usage?.total_tokens ?? null,
    inputTokens: lastEvent?.info.total_token_usage?.input_tokens ?? null,
    outputTokens: lastEvent?.info.total_token_usage?.output_tokens ?? null,
    contextWindow: lastEvent?.info.model_context_window ?? null,
    monthlyTokens: null,
    windows: [
      toLimitWindow('Current Session Limit', lastEvent?.rateLimits.primary),
      toLimitWindow('Weekly Limit', lastEvent?.rateLimits.secondary)
    ].filter((window): window is AIUsageWindow => window !== null),
    modelUsage: []
  }
}

async function getClaudeUsage(): Promise<AIUsageDetectedProvider> {
  const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json')
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  const installed = await fileExists(path.join(os.homedir(), '.local', 'bin', 'claude'))
  const statsExists = await fileExists(statsPath)

  if (!statsExists) {
    return emptyProvider('claude', 'Claude Code', installed)
  }

  const raw = JSON.parse(await fs.readFile(statsPath, 'utf8')) as {
    lastComputedDate?: string
    dailyModelTokens?: Array<{
      date?: string
      tokensByModel?: Record<string, number>
    }>
  }

  const lastUpdatedAt = raw.lastComputedDate ? Date.parse(`${raw.lastComputedDate}T00:00:00.000Z`) : null
  const recentEntries = (raw.dailyModelTokens ?? []).filter((entry) => {
    if (!entry.date) return false
    const timestamp = Date.parse(`${entry.date}T00:00:00.000Z`)
    return Number.isFinite(timestamp) && Date.now() - timestamp <= 30 * 24 * 60 * 60 * 1000
  })
  const weeklyEntries = recentEntries.filter((entry) => {
    if (!entry.date) return false
    const timestamp = Date.parse(`${entry.date}T00:00:00.000Z`)
    return Number.isFinite(timestamp) && Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000
  })

  const monthlyModelTotals = aggregateModelTokens(recentEntries)
  const weeklyModelTotals = aggregateModelTokens(weeklyEntries)
  const modelUsage: AIUsageModelUsage[] = [...monthlyModelTotals.entries()]
    .map(([model, tokens]) => ({ model, tokens }))
    .sort((left, right) => right.tokens - left.tokens)

  const latestProjectFile = await findLatestFile(projectsDir, '.jsonl')
  const sessionUsage = latestProjectFile ? await getClaudeSessionUsage(latestProjectFile) : null
  const weeklyTokens = [...weeklyModelTotals.values()].reduce((sum, tokens) => sum + tokens, 0)

  return {
    id: 'claude',
    tool: 'claude',
    label: 'Claude Code',
    installed,
    sourcePath: latestProjectFile ?? statsPath,
    detectedAt: Date.now(),
    lastUpdatedAt: sessionUsage?.lastUpdatedAt ?? lastUpdatedAt,
    planType: null,
    totalTokens: sessionUsage?.totalTokens ?? null,
    inputTokens: sessionUsage?.inputTokens ?? null,
    outputTokens: sessionUsage?.outputTokens ?? null,
    contextWindow: null,
    monthlyTokens: null,
    windows: [
      {
        label: 'Current Session Usage',
        kind: 'usage',
        usedPercent: null,
        value: sessionUsage?.totalTokens ?? null,
        valueLabel: sessionUsage ? formatNumber(sessionUsage.totalTokens) : null,
        resetsAt: null
      },
      {
        label: 'Current 7 Days',
        kind: 'usage',
        usedPercent: null,
        value: weeklyTokens,
        valueLabel: formatNumber(weeklyTokens),
        resetsAt: null
      }
    ],
    modelUsage
  }
}

async function getClaudeSessionUsage(filePath: string): Promise<{
  inputTokens: number
  outputTokens: number
  totalTokens: number
  lastUpdatedAt: number | null
} | null> {
  const content = await fs.readFile(filePath, 'utf8')
  const lines = content.split('\n')
  let inputTokens = 0
  let outputTokens = 0
  let lastUpdatedAt: number | null = null

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as ClaudeProjectEntry
      const usage = parsed.message?.usage
      if (!usage) continue
      inputTokens += usage.input_tokens ?? 0
      outputTokens += usage.output_tokens ?? 0
      if (parsed.timestamp) {
        const timestamp = Date.parse(parsed.timestamp)
        if (Number.isFinite(timestamp)) lastUpdatedAt = timestamp
      }
    } catch {
      continue
    }
  }

  const totalTokens = inputTokens + outputTokens
  if (totalTokens === 0) return null

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    lastUpdatedAt
  }
}

function aggregateModelTokens(entries: Array<{ tokensByModel?: Record<string, number> }>) {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    for (const [model, tokens] of Object.entries(entry.tokensByModel ?? {})) {
      totals.set(model, (totals.get(model) ?? 0) + tokens)
    }
  }
  return totals
}

function emptyProvider(tool: 'codex' | 'claude', label: string, installed: boolean): AIUsageDetectedProvider {
  return {
    id: tool,
    tool,
    label,
    installed,
    sourcePath: null,
    detectedAt: Date.now(),
    lastUpdatedAt: null,
    planType: null,
    totalTokens: null,
    inputTokens: null,
    outputTokens: null,
    contextWindow: null,
    monthlyTokens: null,
    windows: [],
    modelUsage: []
  }
}

async function findLatestFile(rootDir: string, extension: string): Promise<string | null> {
  try {
    const entries = await walkFiles(rootDir)
    const candidates = await Promise.all(entries
      .filter((entry) => entry.endsWith(extension))
      .map(async (entry) => ({
        entry,
        mtimeMs: (await fs.stat(entry)).mtimeMs
      })))

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
    return candidates[0]?.entry ?? null
  } catch {
    return null
  }
}

async function walkFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(dirents.map(async (dirent) => {
    const fullPath = path.join(dir, dirent.name)
    if (dirent.isDirectory()) return walkFiles(fullPath)
    return [fullPath]
  }))

  return nested.flat()
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function toLimitWindow(
  label: string,
  value: { used_percent?: number; resets_at?: number } | undefined
): AIUsageWindow | null {
  if (!value || typeof value.used_percent !== 'number') return null

  return {
    label,
    kind: 'limit',
    usedPercent: value.used_percent,
    value: null,
    valueLabel: `${value.used_percent.toFixed(1)}%`,
    resetsAt: typeof value.resets_at === 'number' ? value.resets_at * 1000 : null
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}
