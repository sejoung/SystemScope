import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DevServerEntry, DevWorkspaceInsight, PortInfo, ProcessInfo } from '@shared/types'

export function summarizeGitStatusLines(lines: string[]) {
  const untrackedFiles: string[] = []
  let dirtyFileCount = 0

  for (const line of lines) {
    if (!line) continue
    if (line.startsWith('?? ')) {
      untrackedFiles.push(line.slice(3).trim())
      continue
    }
    dirtyFileCount += 1
  }

  return {
    dirtyFileCount,
    untrackedFiles,
  }
}

export function parseGitTimestamp(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : null
}

export function detectDevServers(
  ports: PortInfo[],
  processes: ProcessInfo[],
  workspacePaths: string[],
): DevServerEntry[] {
  const processMap = new Map(processes.map((entry) => [entry.pid, entry]))
  const listening = ports.filter((entry) => normalizePortState(entry.state) === 'LISTEN')
  const devServers: DevServerEntry[] = []

  for (const port of listening) {
    const processInfo = processMap.get(port.pid)
    const command = processInfo?.command ?? null
    const kind = detectDevServerKind(port, processInfo)
    if (!kind) continue

    const workspaceMatch = matchWorkspacePath(command, workspacePaths)
    devServers.push({
      pid: port.pid,
      process: port.process,
      command,
      kind,
      port: port.localPortNum || Number(port.localPort) || 0,
      protocol: port.protocol,
      address: port.localAddress,
      exposure: classifyExposure(port.localAddress),
      workspacePath: workspaceMatch.path,
      workspaceName: workspaceMatch.path ? path.basename(workspaceMatch.path) : null,
      workspaceMatchReason: workspaceMatch.reason,
    })
  }

  return devServers.sort((left, right) => {
    if (left.workspaceName && right.workspaceName && left.workspaceName !== right.workspaceName) {
      return left.workspaceName.localeCompare(right.workspaceName)
    }
    return left.port - right.port
  })
}

export function annotateWorkspaceServerUsage(
  workspaces: DevWorkspaceInsight[],
  devServers: DevServerEntry[],
): DevWorkspaceInsight[] {
  return workspaces.map((workspace) => {
    const matchedServers = devServers
      .filter((server) => server.workspacePath === workspace.path)
      .sort((left, right) => left.port - right.port)

    return {
      ...workspace,
      activeDevServerCount: matchedServers.length,
      activeDevServerPorts: matchedServers.map((server) => server.port),
    }
  })
}

export function detectDevServerKind(port: PortInfo, processInfo?: ProcessInfo | null): string | null {
  const processName = `${port.process} ${processInfo?.name ?? ''}`.toLowerCase()
  const command = (processInfo?.command ?? '').toLowerCase()
  const portNumber = port.localPortNum || Number(port.localPort) || 0

  if (command.includes('storybook')) return 'Storybook'
  if (command.includes('turbopack') || command.includes('next-server')) return 'Turbopack'
  if (command.includes('vite') || portNumber === 5173 || portNumber === 4173) return 'Vite'
  if (command.includes('next') || command.includes('next dev')) return 'Next.js'
  if (command.includes('metro') || command.includes('react-native') || portNumber === 8081) return 'Metro / React Native'
  if (command.includes('uvicorn') || command.includes('fastapi')) return 'FastAPI / Uvicorn'
  if (command.includes('gunicorn')) return 'Gunicorn'
  if (command.includes('django') || command.includes('manage.py runserver')) return 'Django'
  if (command.includes('flask')) return 'Flask'
  if (command.includes('spring-boot') || command.includes('springboot') || command.includes('org.springframework.boot')) return 'Spring Boot'
  if (command.includes('gradle') && (command.includes('bootrun') || command.includes('run'))) return 'Gradle App'
  if (command.includes('rails server') || processName.includes('puma')) return 'Rails'
  if (command.includes('mix phx.server') || processName.includes('beam.smp')) return 'Phoenix'
  if (command.includes('laravel') || command.includes('artisan serve')) return 'Laravel'
  if (command.includes('cargo watch') || command.includes('cargo-watch')) return 'Rust Watch'
  if (command.includes('trunk serve')) return 'Trunk'
  if (command.includes('wasm-pack')) return 'wasm-pack'
  if (command.includes('actix') || command.includes('axum') || command.includes('rocket')) return 'Rust Web App'
  if (processName.includes('postgres') || portNumber === 5432) return 'PostgreSQL'
  if (processName.includes('redis') || portNumber === 6379) return 'Redis'
  if (processName.includes('docker') || command.includes('docker-proxy')) return 'Docker Service'
  if (command.includes('webpack')) return 'Webpack Dev Server'
  if (command.includes('astro')) return 'Astro'
  if (command.includes('nuxt')) return 'Nuxt'
  if (command.includes('cargo run') || command.includes('/target/debug/') || command.includes('/target/release/')) return 'Rust App'
  if (command.includes('go run') || command.includes('/go-build')) return 'Go App'
  if (
    portNumber === 3000 ||
    portNumber === 3001 ||
    portNumber === 8000 ||
    portNumber === 8080 ||
    processName.includes('node') ||
    processName.includes('bun') ||
    processName.includes('python') ||
    processName.includes('java')
  ) {
    return 'App Server'
  }

  return null
}

function classifyExposure(address: string): DevServerEntry['exposure'] {
  const normalized = address.trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') {
    return 'loopback'
  }
  return 'network'
}

function matchWorkspacePath(command: string | null, workspacePaths: string[]): {
  path: string | null
  reason: string | null
} {
  if (!command) {
    return { path: null, reason: null }
  }

  const normalizedCommand = command.toLowerCase()
  const exactMatches = workspacePaths
    .filter((workspacePath) => normalizedCommand.includes(workspacePath.toLowerCase()))
    .sort((left, right) => right.length - left.length)

  if (exactMatches[0]) {
    return {
      path: exactMatches[0],
      reason: 'Matched from the running command path.',
    }
  }

  const tokens = command
    .split(/\s+/)
    .map((token) => token.replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean)

  for (const token of tokens) {
    const normalizedToken = token.toLowerCase()
    const tokenMatch = workspacePaths
      .filter((workspacePath) => normalizedToken.startsWith(workspacePath.toLowerCase()))
      .sort((left, right) => right.length - left.length)[0]

    if (tokenMatch) {
      return {
        path: tokenMatch,
        reason: 'Matched from a child path referenced by the command.',
      }
    }
  }

  const basenameMatches = workspacePaths.filter((workspacePath) => {
    const baseName = path.basename(workspacePath).toLowerCase()
    return baseName.length > 2 && normalizedCommand.includes(baseName)
  })

  if (basenameMatches.length === 1) {
    return {
      path: basenameMatches[0],
      reason: 'Matched from the workspace name mentioned in the command.',
    }
  }

  return { path: null, reason: null }
}

function normalizePortState(state: string): string {
  const normalized = state.trim().toUpperCase()
  return normalized === 'LISTENING' ? 'LISTEN' : normalized
}

export function extractVersion(output: string): string | null {
  const trimmed = output.trim()
  if (!trimmed) return null
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? ''
  return firstLine || null
}

export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function pathExistsNearWorkspace(
  workspacePath: string,
  fileNames: string[],
  maxDepth = 1,
  matchDirectory = false,
): Promise<boolean> {
  async function search(currentPath: string, depth: number): Promise<boolean> {
    for (const fileName of fileNames) {
      const candidatePath = path.join(currentPath, fileName)
      if (matchDirectory) {
        try {
          const stat = await fs.stat(candidatePath)
          if (stat.isDirectory()) return true
        } catch {
          // continue
        }
      } else if (await pathExists(candidatePath)) {
        return true
      }
    }

    if (depth >= maxDepth) {
      return false
    }

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === 'target') continue
        if (await search(path.join(currentPath, entry.name), depth + 1)) {
          return true
        }
      }
    } catch {
      return false
    }

    return false
  }

  return search(workspacePath, 0)
}
