import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import type {
  DevDockerInsight,
  DevEnvironmentCheck,
  DevServerEntry,
  DevToolsOverview,
  DevWorkspaceInsight,
  DevWorkspacePythonEnv,
  DevWorkspacePythonEnvType,
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
  const isMac = process.platform === 'darwin'
  const pythonCheck = await detectPython()
  const checks = await Promise.all([
    runVersionCheck('git', 'Git', ['--version'], 'Install Git to enable workspace insights and branch status.'),
    runVersionCheck('node', 'Node.js', ['--version'], 'Install Node.js to run local JavaScript toolchains.'),
    runVersionCheck('java', 'Java', ['-version'], 'Install a JDK to run JVM toolchains and Gradle-based builds.'),
    runVersionCheck('npm', 'npm', ['--version'], 'npm is usually bundled with Node.js.'),
    runVersionCheck('pnpm', 'pnpm', ['--version'], 'Install pnpm if your workspaces use pnpm-lock.yaml.'),
    runVersionCheck('yarn', 'Yarn', ['--version'], 'Install Yarn if your workspaces use yarn.lock.'),
    runVersionCheck('docker', 'Docker CLI', ['--version'], 'Install Docker Desktop or Docker Engine to use Docker commands locally.'),
    isMac
      ? runVersionCheck('xcodebuild', 'Xcode CLI', ['-version'], 'Install Xcode Command Line Tools for Apple platform builds.')
      : Promise.resolve<DevEnvironmentCheck | null>(null),
    isMac
      ? detectAndroidSdk()
      : Promise.resolve<DevEnvironmentCheck | null>(null),
    Promise.resolve<DevEnvironmentCheck | null>(pythonCheck),
    isMac
      ? Promise.resolve<DevEnvironmentCheck | null>(null)
      : detectCuda(),
    isMac
      ? Promise.resolve<DevEnvironmentCheck | null>(null)
      : detectNvidiaDriver(),
    pythonCheck && pythonCheck.status === 'healthy' && pythonCheck.extra?.interpreterPath
      ? detectSystemPyTorch(String(pythonCheck.extra.interpreterPath))
      : Promise.resolve<DevEnvironmentCheck | null>(null),
  ])

  return checks.filter((entry): entry is DevEnvironmentCheck => entry !== null)
}

async function detectPython(): Promise<DevEnvironmentCheck> {
  const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python']

  for (const command of candidates) {
    try {
      const { stdout, stderr } = await runExternalCommand(command, ['--version'], { timeout: 3000 })
      const combined = `${stdout}\n${stderr}`.trim()
      const version = extractVersion(combined)
      const interpreterPath = await resolveCommandPath(command)
      return {
        id: 'python',
        label: 'Python',
        status: 'healthy',
        detail: version ? 'Python is available.' : 'Available',
        version,
        hint: null,
        extra: {
          interpreterPath: interpreterPath ?? command,
          command,
        },
      }
    } catch (error) {
      if (isExternalCommandError(error) && error.kind === 'command_not_found') {
        continue
      }
      return {
        id: 'python',
        label: 'Python',
        status: 'warning',
        detail: 'Python could not be verified.',
        version: null,
        hint: 'Ensure python3 or python is installed and on PATH.',
        extra: null,
      }
    }
  }

  return {
    id: 'python',
    label: 'Python',
    status: 'missing',
    detail: 'Python is not installed.',
    version: null,
    hint: 'Install Python 3.10+ for ML/AI toolchains, FastAPI, and PyTorch workflows.',
    extra: null,
  }
}

async function detectCuda(): Promise<DevEnvironmentCheck> {
  try {
    const { stdout, stderr } = await runExternalCommand('nvcc', ['--version'], { timeout: 3000 })
    const combined = `${stdout}\n${stderr}`.trim()
    const version = parseCudaToolkitVersion(combined) ?? extractVersion(combined)
    return {
      id: 'cuda',
      label: 'CUDA Toolkit',
      status: 'healthy',
      detail: version ? 'CUDA Toolkit is available.' : 'Available',
      version,
      hint: null,
      extra: null,
    }
  } catch (error) {
    if (isExternalCommandError(error) && error.kind === 'command_not_found') {
      const fallback = await detectCudaFromFilesystem()
      if (fallback) return fallback
      return {
        id: 'cuda',
        label: 'CUDA Toolkit',
        status: 'missing',
        detail: 'CUDA Toolkit is not installed.',
        version: null,
        hint: 'Install the NVIDIA CUDA Toolkit to build GPU-accelerated code.',
        extra: null,
      }
    }
    return {
      id: 'cuda',
      label: 'CUDA Toolkit',
      status: 'warning',
      detail: 'CUDA Toolkit could not be verified.',
      version: null,
      hint: 'nvcc was found but did not report a version.',
      extra: null,
    }
  }
}

async function detectCudaFromFilesystem(): Promise<DevEnvironmentCheck | null> {
  const candidates: string[] = []
  if (process.platform === 'win32') {
    if (process.env.CUDA_PATH) candidates.push(path.join(process.env.CUDA_PATH, 'version.txt'))
  } else {
    candidates.push('/usr/local/cuda/version.txt', '/usr/local/cuda/version.json')
    if (process.env.CUDA_HOME) candidates.push(path.join(process.env.CUDA_HOME, 'version.txt'))
  }

  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, 'utf8')
      const version = parseCudaVersionFile(content)
      if (version) {
        return {
          id: 'cuda',
          label: 'CUDA Toolkit',
          status: 'healthy',
          detail: 'CUDA Toolkit detected via filesystem.',
          version,
          hint: `Found at ${path.dirname(candidate)}. Add nvcc to PATH for full integration.`,
          extra: null,
        }
      }
    } catch {
      continue
    }
  }
  return null
}

async function detectNvidiaDriver(): Promise<DevEnvironmentCheck> {
  try {
    const { stdout } = await runExternalCommand(
      'nvidia-smi',
      ['--query-gpu=driver_version,name', '--format=csv,noheader'],
      { timeout: 4000 },
    )
    const firstLine = stdout.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean)
    if (!firstLine) {
      return {
        id: 'nvidia-driver',
        label: 'NVIDIA Driver',
        status: 'warning',
        detail: 'nvidia-smi returned no output.',
        version: null,
        hint: 'Verify that an NVIDIA GPU is present and the driver is loaded.',
        extra: null,
      }
    }
    const [driverVersion, ...rest] = firstLine.split(',').map((entry) => entry.trim())
    const gpuModel = rest.join(', ') || null
    return {
      id: 'nvidia-driver',
      label: 'NVIDIA Driver',
      status: 'healthy',
      detail: 'NVIDIA driver is available.',
      version: driverVersion || null,
      hint: gpuModel,
      extra: gpuModel ? { gpuModel, driverVersion: driverVersion || null } : { driverVersion: driverVersion || null },
    }
  } catch (error) {
    if (isExternalCommandError(error) && error.kind === 'command_not_found') {
      return {
        id: 'nvidia-driver',
        label: 'NVIDIA Driver',
        status: 'missing',
        detail: 'NVIDIA driver tools are not installed.',
        version: null,
        hint: 'Install the NVIDIA driver if this machine has an NVIDIA GPU.',
        extra: null,
      }
    }
    return {
      id: 'nvidia-driver',
      label: 'NVIDIA Driver',
      status: 'warning',
      detail: 'NVIDIA driver could not be verified.',
      version: null,
      hint: 'nvidia-smi failed. The driver may not be loaded.',
      extra: null,
    }
  }
}

async function detectSystemPyTorch(interpreterPath: string): Promise<DevEnvironmentCheck> {
  const torchProbe = await probeTorch(interpreterPath)
  if (torchProbe.status === 'missing') {
    return {
      id: 'pytorch',
      label: 'PyTorch (system)',
      status: 'missing',
      detail: 'PyTorch is not installed in the system Python.',
      version: null,
      hint: 'Install with: pip install torch (or follow pytorch.org for CUDA-enabled wheels).',
      extra: null,
    }
  }
  if (torchProbe.status === 'error') {
    return {
      id: 'pytorch',
      label: 'PyTorch (system)',
      status: 'warning',
      detail: 'PyTorch could not be verified.',
      version: null,
      hint: torchProbe.note,
      extra: null,
    }
  }
  return {
    id: 'pytorch',
    label: 'PyTorch (system)',
    status: 'healthy',
    detail: torchProbe.cudaAvailable
      ? 'PyTorch is available with CUDA support.'
      : 'PyTorch is available (CPU only).',
    version: torchProbe.version,
    hint: `Interpreter: ${interpreterPath}`,
    extra: {
      interpreterPath,
      torchCudaAvailable: torchProbe.cudaAvailable,
    },
  }
}

type TorchProbeResult =
  | { status: 'ready'; version: string; cudaAvailable: boolean | null; note: string | null }
  | { status: 'missing'; note: string | null }
  | { status: 'error'; note: string }

async function probeTorch(interpreterPath: string): Promise<TorchProbeResult> {
  const script = 'import json,sys\ntry:\n  import torch\n  cuda=None\n  try:\n    cuda=bool(torch.cuda.is_available())\n  except Exception:\n    cuda=None\n  print(json.dumps({"ok":True,"version":torch.__version__,"cuda":cuda}))\nexcept ModuleNotFoundError:\n  print(json.dumps({"ok":False,"reason":"missing"}))\nexcept Exception as exc:\n  print(json.dumps({"ok":False,"reason":"error","message":str(exc)}))\n'
  try {
    const { stdout } = await runExternalCommand(interpreterPath, ['-c', script], { timeout: 6000 })
    const line = stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).pop() ?? ''
    if (!line) {
      return { status: 'error', note: 'Empty response from python probe.' }
    }
    let parsed: { ok?: boolean; version?: string; cuda?: boolean | null; reason?: string; message?: string }
    try {
      parsed = JSON.parse(line) as typeof parsed
    } catch {
      return { status: 'error', note: 'Unexpected probe output.' }
    }
    if (parsed.ok && typeof parsed.version === 'string') {
      return {
        status: 'ready',
        version: parsed.version,
        cudaAvailable: parsed.cuda ?? null,
        note: null,
      }
    }
    if (parsed.reason === 'missing') {
      return { status: 'missing', note: null }
    }
    return { status: 'error', note: parsed.message ?? 'torch import raised an error.' }
  } catch (error) {
    if (isExternalCommandError(error) && error.kind === 'command_not_found') {
      return { status: 'error', note: 'Python interpreter not executable.' }
    }
    return { status: 'error', note: 'Python probe failed.' }
  }
}

function parseCudaToolkitVersion(output: string): string | null {
  const match = output.match(/release\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i)
  return match ? match[1] : null
}

function parseCudaVersionFile(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { cuda?: { version?: string } }
      if (json?.cuda?.version) return json.cuda.version
    } catch {
      // fall through
    }
  }
  const match = trimmed.match(/CUDA Version\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i)
  return match ? match[1] : null
}

async function resolveCommandPath(command: string): Promise<string | null> {
  if (command.includes(path.sep)) {
    return command
  }
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const { stdout } = await runExternalCommand(finder, [command], { timeout: 2000 })
    const first = stdout.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean)
    return first ?? null
  } catch {
    return null
  }
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
      extra: null,
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
        extra: null,
      }
    }

    return {
      id: command,
      label,
      status: 'warning',
      detail: `${label} could not be verified.`,
      version: null,
      hint,
      extra: null,
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
        extra: null,
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
    extra: null,
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
    pythonEnv: null,
  }

  if (!exists) {
    return base
  }

  const [projectSignals, pythonEnv] = await Promise.all([
    detectWorkspaceProjectSignals(workspacePath),
    detectWorkspacePythonEnv(workspacePath),
  ])
  const withSignals: DevWorkspaceInsight = {
    ...base,
    ...projectSignals,
    pythonEnv,
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
      pythonEnv,
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
    pathExistsNearWorkspace(workspacePath, ['package.json'], 2),
    pathExistsNearWorkspace(workspacePath, ['pyproject.toml'], 2),
    pathExistsNearWorkspace(workspacePath, ['requirements.txt'], 2),
    pathExistsNearWorkspace(workspacePath, ['pom.xml'], 2),
    pathExistsNearWorkspace(workspacePath, ['build.gradle'], 2),
    pathExistsNearWorkspace(workspacePath, ['build.gradle.kts'], 2),
    pathExistsNearWorkspace(workspacePath, ['Cargo.toml'], 2),
    pathExistsNearWorkspace(workspacePath, ['go.mod'], 2),
    pathExistsNearWorkspace(workspacePath, ['tsconfig.json'], 2),
    pathExistsNearWorkspace(workspacePath, ['jsconfig.json'], 2),
    pathExistsNearWorkspace(workspacePath, ['.env'], 2),
    pathExistsNearWorkspace(workspacePath, ['.env.local'], 2),
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
    pathExistsNearWorkspace(workspacePath, ['tauri.conf.json', 'tauri.conf.json5', 'tauri.conf.toml'], 2),
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
    hasTauriConfig,
  ] = fileChecks

  const artifactChecks = await Promise.all(
    DEV_ARTIFACT_DIRS.map(async (dirName) => ((await pathExistsNearWorkspace(workspacePath, [dirName], 2, true)) ? dirName : null)),
  )

  const stacks = [
    hasTauriConfig ? 'Tauri' : null,
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

const PYTHON_ENV_CANDIDATE_NAMES = ['.venv', 'venv', '.env', 'env'] as const

interface PythonEnvCandidate {
  envType: DevWorkspacePythonEnvType
  envPath: string | null
  interpreterPath: string
}

export async function findWorkspacePythonInterpreter(workspacePath: string): Promise<PythonEnvCandidate | null> {
  const interpreterSubpath = process.platform === 'win32'
    ? path.join('Scripts', 'python.exe')
    : path.join('bin', 'python')

  // Search up to depth 2 for a venv-style folder.
  const found = await searchPythonEnv(workspacePath, interpreterSubpath, 0, 2)
  if (found) return found

  // Look for explicit conda env marker (`conda-meta`) inside workspace.
  const condaCandidate = await findCondaEnv(workspacePath, 0, 2)
  if (condaCandidate) return condaCandidate

  return null
}

async function searchPythonEnv(
  currentPath: string,
  interpreterSubpath: string,
  depth: number,
  maxDepth: number,
): Promise<PythonEnvCandidate | null> {
  for (const envName of PYTHON_ENV_CANDIDATE_NAMES) {
    const envPath = path.join(currentPath, envName)
    const interpreterPath = path.join(envPath, interpreterSubpath)
    if (await pathExists(interpreterPath)) {
      return { envType: 'venv', envPath, interpreterPath }
    }
  }
  if (depth >= maxDepth) return null

  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name.startsWith('.')) continue
      const child = await searchPythonEnv(path.join(currentPath, entry.name), interpreterSubpath, depth + 1, maxDepth)
      if (child) return child
    }
  } catch {
    return null
  }

  return null
}

async function findCondaEnv(
  currentPath: string,
  depth: number,
  maxDepth: number,
): Promise<PythonEnvCandidate | null> {
  if (await pathExists(path.join(currentPath, 'conda-meta'))) {
    const interpreterSubpath = process.platform === 'win32' ? 'python.exe' : path.join('bin', 'python')
    const interpreterPath = path.join(currentPath, interpreterSubpath)
    if (await pathExists(interpreterPath)) {
      return { envType: 'conda', envPath: currentPath, interpreterPath }
    }
  }
  if (depth >= maxDepth) return null
  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name.startsWith('.')) continue
      const child = await findCondaEnv(path.join(currentPath, entry.name), depth + 1, maxDepth)
      if (child) return child
    }
  } catch {
    return null
  }
  return null
}

async function detectWorkspacePythonEnv(workspacePath: string): Promise<DevWorkspacePythonEnv | null> {
  const candidate = await findWorkspacePythonInterpreter(workspacePath)
  if (!candidate) return null

  let pythonVersion: string | null = null
  let detectionNote: string | null = null
  try {
    const { stdout, stderr } = await runExternalCommand(candidate.interpreterPath, ['--version'], {
      timeout: 3000,
    })
    pythonVersion = extractVersion(`${stdout}\n${stderr}`.trim())
  } catch {
    detectionNote = 'Interpreter could not report a version.'
  }

  const torchProbe = await probeTorch(candidate.interpreterPath)
  if (torchProbe.status === 'ready') {
    return {
      envType: candidate.envType,
      envPath: candidate.envPath,
      interpreterPath: candidate.interpreterPath,
      pythonVersion,
      torchVersion: torchProbe.version,
      torchCudaAvailable: torchProbe.cudaAvailable,
      detectionNote,
    }
  }
  if (torchProbe.status === 'missing') {
    return {
      envType: candidate.envType,
      envPath: candidate.envPath,
      interpreterPath: candidate.interpreterPath,
      pythonVersion,
      torchVersion: null,
      torchCudaAvailable: null,
      detectionNote: detectionNote ?? 'PyTorch is not installed in this environment.',
    }
  }
  return {
    envType: candidate.envType,
    envPath: candidate.envPath,
    interpreterPath: candidate.interpreterPath,
    pythonVersion,
    torchVersion: null,
    torchCudaAvailable: null,
    detectionNote: detectionNote ?? torchProbe.note,
  }
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
    if (await pathExistsNearWorkspace(workspacePath, [fileName], 2)) {
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

async function pathExistsNearWorkspace(
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
