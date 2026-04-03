import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import type {
  DevDockerInsight,
  DevEnvironmentCheck,
  DevServerEntry,
  DevToolsOverview,
  DevWorkspaceInsight,
  PortInfo,
  ProcessInfo,
} from '@shared/types'
import { runExternalCommand, isExternalCommandError } from './externalCommand'
import { getAllProcesses, getNetworkPorts } from './processMonitor'
import { getActiveProfile } from './profileManager'
import { getDockerBuildCache, listDockerContainers, listDockerImages, listDockerVolumes } from './dockerImages'

const LARGE_UNTRACKED_FILE_BYTES = 5 * 1024 * 1024
const MAX_LARGE_UNTRACKED_FILES = 3
const DOCKER_INSIGHT_TTL_MS = 15_000
const DEV_ARTIFACT_DIRS = ['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.gradle', 'target', '.venv'] as const

let cachedDockerInsight: { value: DevDockerInsight; cachedAt: number } | null = null
let dockerInsightInflight: Promise<DevDockerInsight> | null = null

export function resetDevToolsOverviewCacheForTest(): void {
  cachedDockerInsight = null
  dockerInsightInflight = null
}

export async function getDevToolsOverview(options?: { forceRefresh?: boolean }): Promise<DevToolsOverview> {
  if (options?.forceRefresh) {
    resetDevToolsOverviewCacheForTest()
  }
  const workspacePaths = Array.from(
    new Set((getActiveProfile()?.workspacePaths ?? []).map((entry) => path.resolve(entry))),
  )

  const [healthChecks, docker, rawWorkspaces, ports, processes] = await Promise.all([
    collectEnvironmentChecks(),
    collectDockerInsight(),
    Promise.all(workspacePaths.map((workspacePath) => collectWorkspaceInsight(workspacePath))),
    getNetworkPorts().catch(() => []),
    getAllProcesses().catch(() => []),
  ])
  const devServers = detectDevServers(ports, processes, workspacePaths)
  const workspaces = annotateWorkspaceServerUsage(rawWorkspaces, devServers)

  return {
    healthChecks,
    docker,
    workspaces,
    devServers,
    scannedAt: Date.now(),
  }
}

async function collectEnvironmentChecks(): Promise<DevEnvironmentCheck[]> {
  const checks = await Promise.all([
    runVersionCheck('git', 'Git', ['--version'], 'Install Git to enable workspace insights and branch status.'),
    runVersionCheck('node', 'Node.js', ['--version'], 'Install Node.js to run local JavaScript toolchains.'),
    runVersionCheck('java', 'Java', ['-version'], 'Install a JDK to run JVM toolchains and Gradle-based builds.'),
    runVersionCheck('npm', 'npm', ['--version'], 'npm is usually bundled with Node.js.'),
    runVersionCheck('pnpm', 'pnpm', ['--version'], 'Install pnpm if your workspaces use pnpm-lock.yaml.'),
    runVersionCheck('yarn', 'Yarn', ['--version'], 'Install Yarn if your workspaces use yarn.lock.'),
    runVersionCheck('docker', 'Docker CLI', ['--version'], 'Install Docker Desktop or Docker Engine to use Docker commands locally.'),
    process.platform === 'darwin'
      ? runVersionCheck('xcodebuild', 'Xcode CLI', ['-version'], 'Install Xcode Command Line Tools for Apple platform builds.')
      : Promise.resolve<DevEnvironmentCheck | null>(null),
    process.platform === 'darwin'
      ? detectAndroidSdk()
      : Promise.resolve<DevEnvironmentCheck | null>(null),
  ])

  return checks.filter((entry): entry is DevEnvironmentCheck => entry !== null)
}

async function runVersionCheck(
  command: string,
  label: string,
  args: string[],
  hint: string,
): Promise<DevEnvironmentCheck> {
  try {
    const { stdout, stderr } = await runExternalCommand(command, args, { timeout: 3000 })
    const combined = `${stdout}\n${stderr}`.trim()
    const version = extractVersion(combined)
    return {
      id: command,
      label,
      status: 'healthy',
      detail: version ? `${label} is available.` : 'Available',
      version,
      hint: null,
    }
  } catch (error) {
    if (isExternalCommandError(error) && error.kind === 'command_not_found') {
      return {
        id: command,
        label,
        status: 'missing',
        detail: `${label} is not installed.`,
        version: null,
        hint,
      }
    }

    return {
      id: command,
      label,
      status: 'warning',
      detail: `${label} could not be verified.`,
      version: null,
      hint,
    }
  }
}

async function detectAndroidSdk(): Promise<DevEnvironmentCheck> {
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    path.join(os.homedir(), 'Library/Android/sdk'),
  ].filter((entry): entry is string => Boolean(entry))

  for (const sdkPath of candidates) {
    try {
      await fs.access(sdkPath)
      return {
        id: 'android-sdk',
        label: 'Android SDK',
        status: 'healthy',
        detail: 'Android SDK path detected.',
        version: null,
        hint: sdkPath,
      }
    } catch {
      continue
    }
  }

  return {
    id: 'android-sdk',
    label: 'Android SDK',
    status: 'warning',
    detail: 'Android SDK path was not found.',
    version: null,
    hint: 'Set ANDROID_SDK_ROOT or install Android Studio.',
  }
}

async function collectDockerInsight(): Promise<DevDockerInsight> {
  const now = Date.now()
  if (cachedDockerInsight && now - cachedDockerInsight.cachedAt < DOCKER_INSIGHT_TTL_MS) {
    return cachedDockerInsight.value
  }
  if (dockerInsightInflight) {
    return dockerInsightInflight
  }

  dockerInsightInflight = loadDockerInsight()
  try {
    const value = await dockerInsightInflight
    cachedDockerInsight = { value, cachedAt: Date.now() }
    return value
  } finally {
    dockerInsightInflight = null
  }
}

async function loadDockerInsight(): Promise<DevDockerInsight> {
  const [containers, images, volumes, buildCache] = await Promise.all([
    listDockerContainers().catch(() => ({
      status: 'daemon_unavailable' as const,
      containers: [],
      message: 'Docker daemon could not be reached.',
    })),
    listDockerImages().catch(() => ({
      status: 'daemon_unavailable' as const,
      images: [],
      message: 'Docker image data could not be loaded.',
    })),
    listDockerVolumes().catch(() => ({
      status: 'daemon_unavailable' as const,
      volumes: [],
      message: 'Docker volume data could not be loaded.',
    })),
    getDockerBuildCache().catch(() => ({
      status: 'daemon_unavailable' as const,
      summary: null,
      message: 'Docker build cache data could not be loaded.',
    })),
  ])

  const statuses = [containers.status, images.status, volumes.status, buildCache.status]
  const firstMessage =
    containers.message
    ?? images.message
    ?? volumes.message
    ?? buildCache.message
    ?? null

  let status: DevDockerInsight['status'] = 'healthy'
  let detail = 'Docker Engine is ready.'
  let hint: string | null = null

  if (statuses.includes('not_installed')) {
    status = 'missing'
    detail = 'Docker is not installed.'
    hint = firstMessage ?? 'Install Docker Desktop or Docker Engine.'
  } else if (statuses.some((entry) => entry !== 'ready')) {
    status = 'warning'
    detail = 'Docker needs attention.'
    hint = firstMessage ?? 'Start Docker Desktop or Docker Engine.'
  }

  return {
    status,
    detail,
    hint,
    runningContainers: containers.status === 'ready'
      ? containers.containers.filter((container) => container.running).length
      : 0,
    stoppedContainers: containers.status === 'ready'
      ? containers.containers.filter((container) => !container.running).length
      : 0,
    unusedImages: images.status === 'ready'
      ? images.images.filter((image) => !image.inUse).length
      : 0,
    unusedVolumes: volumes.status === 'ready'
      ? volumes.volumes.filter((volume) => !volume.inUse).length
      : 0,
    reclaimableBuildCacheBytes: buildCache.status === 'ready'
      ? (buildCache.summary?.reclaimableBytes ?? 0)
      : 0,
    reclaimableBuildCacheLabel: buildCache.status === 'ready'
      ? (buildCache.summary?.reclaimableLabel ?? '0 B')
      : '0 B',
  }
}

async function collectWorkspaceInsight(workspacePath: string): Promise<DevWorkspaceInsight> {
  const exists = await pathExists(workspacePath)
  const packageManager = await detectPackageManager(workspacePath)

  const base: DevWorkspaceInsight = {
    path: workspacePath,
    name: path.basename(workspacePath) || workspacePath,
    exists,
    isGitRepo: false,
    branch: null,
    packageManager,
    stacks: [],
    hasEnvFile: false,
    hasDockerConfig: false,
    hasTypeScriptConfig: false,
    manifestCount: 0,
    artifactDirectories: [],
    dirtyFileCount: 0,
    untrackedFileCount: 0,
    stashCount: 0,
    lastCommitAt: null,
    largeUntrackedFiles: [],
    activeDevServerCount: 0,
    activeDevServerPorts: [],
  }

  if (!exists) {
    return base
  }

  const projectSignals = await detectWorkspaceProjectSignals(workspacePath)
  const withSignals: DevWorkspaceInsight = {
    ...base,
    ...projectSignals,
  }

  try {
    const { stdout } = await runExternalCommand('git', ['rev-parse', '--show-toplevel'], {
      cwd: workspacePath,
      timeout: 3000,
    })
    const repoRoot = stdout.trim()
    if (!repoRoot) return withSignals

    const [branchResult, statusResult, stashResult, lastCommitResult] = await Promise.all([
      runGitCommand(workspacePath, ['branch', '--show-current']),
      runGitCommand(workspacePath, ['status', '--porcelain=v1', '--untracked-files=all']),
      runGitCommand(workspacePath, ['stash', 'list']),
      runGitCommand(workspacePath, ['log', '-1', '--format=%ct']),
    ])

    const statusLines = splitLines(statusResult)
    const { dirtyFileCount, untrackedFiles } = summarizeGitStatusLines(statusLines)
    const branch = branchResult.trim() || null
    const lastCommitAt = parseGitTimestamp(lastCommitResult)

    return {
      ...base,
      ...projectSignals,
      isGitRepo: true,
      branch,
      dirtyFileCount,
      untrackedFileCount: untrackedFiles.length,
      stashCount: splitLines(stashResult).length,
      lastCommitAt,
      largeUntrackedFiles: await findLargeUntrackedFiles(repoRoot, untrackedFiles),
    }
  } catch {
    return withSignals
  }
}

async function detectWorkspaceProjectSignals(workspacePath: string): Promise<Pick<
  DevWorkspaceInsight,
  'stacks' | 'hasEnvFile' | 'hasDockerConfig' | 'hasTypeScriptConfig' | 'manifestCount' | 'artifactDirectories'
>> {
  const fileChecks = await Promise.all([
    pathExists(path.join(workspacePath, 'package.json')),
    pathExistsNearWorkspace(workspacePath, ['pyproject.toml']),
    pathExistsNearWorkspace(workspacePath, ['requirements.txt']),
    pathExistsNearWorkspace(workspacePath, ['pom.xml']),
    pathExistsNearWorkspace(workspacePath, ['build.gradle']),
    pathExistsNearWorkspace(workspacePath, ['build.gradle.kts']),
    pathExistsNearWorkspace(workspacePath, ['Cargo.toml']),
    pathExistsNearWorkspace(workspacePath, ['go.mod']),
    pathExists(path.join(workspacePath, 'tsconfig.json')),
    pathExists(path.join(workspacePath, 'jsconfig.json')),
    pathExists(path.join(workspacePath, '.env')),
    pathExists(path.join(workspacePath, '.env.local')),
    pathExists(path.join(workspacePath, 'Dockerfile')),
    pathExists(path.join(workspacePath, 'docker-compose.yml')),
    pathExists(path.join(workspacePath, 'docker-compose.yaml')),
    pathExists(path.join(workspacePath, 'compose.yml')),
    pathExists(path.join(workspacePath, 'vite.config.ts')),
    pathExists(path.join(workspacePath, 'vite.config.js')),
    pathExists(path.join(workspacePath, 'next.config.js')),
    pathExists(path.join(workspacePath, 'next.config.mjs')),
    pathExists(path.join(workspacePath, 'next.config.ts')),
    pathExists(path.join(workspacePath, 'astro.config.mjs')),
    pathExists(path.join(workspacePath, 'nuxt.config.ts')),
  ])

  const [
    hasPackageJson,
    hasPyproject,
    hasRequirements,
    hasPom,
    hasGradle,
    hasGradleKts,
    hasCargo,
    hasGoMod,
    hasTsConfig,
    hasJsConfig,
    hasEnv,
    hasEnvLocal,
    hasDockerfile,
    hasComposeYml,
    hasComposeYaml,
    hasComposeShort,
    hasViteConfigTs,
    hasViteConfigJs,
    hasNextConfigJs,
    hasNextConfigMjs,
    hasNextConfigTs,
    hasAstroConfig,
    hasNuxtConfig,
  ] = fileChecks

  const artifactChecks = await Promise.all(
    DEV_ARTIFACT_DIRS.map(async (dirName) => ((await pathExists(path.join(workspacePath, dirName))) ? dirName : null)),
  )

  const stacks = [
    hasViteConfigTs || hasViteConfigJs ? 'Vite' : null,
    hasNextConfigJs || hasNextConfigMjs || hasNextConfigTs ? 'Next.js' : null,
    hasAstroConfig ? 'Astro' : null,
    hasNuxtConfig ? 'Nuxt' : null,
    hasPackageJson ? 'Node.js' : null,
    hasPyproject || hasRequirements ? 'Python' : null,
    hasPom || hasGradle || hasGradleKts ? 'JVM' : null,
    hasCargo ? 'Rust' : null,
    hasGoMod ? 'Go' : null,
    hasDockerfile || hasComposeYml || hasComposeYaml || hasComposeShort ? 'Docker' : null,
  ].filter((entry, index, all): entry is string => Boolean(entry) && all.indexOf(entry) === index)

  const manifestCount = [
    hasPackageJson,
    hasPyproject,
    hasRequirements,
    hasPom,
    hasGradle,
    hasGradleKts,
    hasCargo,
    hasGoMod,
  ].filter(Boolean).length

  return {
    stacks,
    hasEnvFile: hasEnv || hasEnvLocal,
    hasDockerConfig: hasDockerfile || hasComposeYml || hasComposeYaml || hasComposeShort,
    hasTypeScriptConfig: hasTsConfig || hasJsConfig,
    manifestCount,
    artifactDirectories: artifactChecks.flatMap((entry) => (entry ? [entry] : [])),
  }
}

async function runGitCommand(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await runExternalCommand('git', args, { cwd, timeout: 4000 })
  return stdout.trim()
}

async function detectPackageManager(workspacePath: string): Promise<string | null> {
  const candidates = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['uv.lock', 'uv'],
    ['poetry.lock', 'poetry'],
    ['Pipfile.lock', 'pipenv'],
    ['Pipfile', 'pipenv'],
    ['requirements.txt', 'pip'],
    ['pyproject.toml', 'python'],
    ['mvnw', 'maven'],
    ['pom.xml', 'maven'],
    ['gradlew', 'gradle'],
    ['build.gradle', 'gradle'],
    ['build.gradle.kts', 'gradle'],
    ['Cargo.toml', 'cargo'],
    ['go.mod', 'go'],
  ] as const

  for (const [fileName, label] of candidates) {
    if (await pathExistsNearWorkspace(workspacePath, [fileName])) {
      return label
    }
  }

  return null
}

async function findLargeUntrackedFiles(repoRoot: string, relativePaths: string[]) {
  const candidates = relativePaths.slice(0, 50)
  const sized = await Promise.all(
    candidates.map(async (relativePath) => {
      const fullPath = path.resolve(repoRoot, relativePath)
      try {
        const stat = await fs.stat(fullPath)
        if (!stat.isFile() || stat.size < LARGE_UNTRACKED_FILE_BYTES) {
          return null
        }
        return { path: fullPath, size: stat.size }
      } catch {
        return null
      }
    }),
  )

  return sized
    .filter((entry): entry is { path: string; size: number } => entry !== null)
    .sort((left, right) => right.size - left.size)
    .slice(0, MAX_LARGE_UNTRACKED_FILES)
}

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

function parseGitTimestamp(value: string): number | null {
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

function annotateWorkspaceServerUsage(
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

function extractVersion(output: string): string | null {
  const trimmed = output.trim()
  if (!trimmed) return null
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? ''
  return firstLine || null
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function pathExistsNearWorkspace(workspacePath: string, fileNames: string[]): Promise<boolean> {
  for (const fileName of fileNames) {
    if (await pathExists(path.join(workspacePath, fileName))) {
      return true
    }
  }

  try {
    const entries = await fs.readdir(workspacePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      for (const fileName of fileNames) {
        if (await pathExists(path.join(workspacePath, entry.name, fileName))) {
          return true
        }
      }
    }
  } catch {
    return false
  }

  return false
}
