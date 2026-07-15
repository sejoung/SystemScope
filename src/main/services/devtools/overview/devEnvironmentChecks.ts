import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import type { DevEnvironmentCheck } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from '@main/services/core/externalCommand'
import { extractVersion } from './devServerDetection'
import { detectCuda, detectNvidiaDriver } from './devCudaChecks'

export async function collectEnvironmentChecks(): Promise<DevEnvironmentCheck[]> {
  const isMac = process.platform === 'darwin'

  // Run the Python detection + dependent PyTorch probe concurrently with the other
  // checks instead of awaiting it first (which serialized it ahead of everything).
  const pythonAndTorch = (async (): Promise<DevEnvironmentCheck[]> => {
    const pythonCheck = await detectPython()
    const result: DevEnvironmentCheck[] = [pythonCheck]
    if (pythonCheck.status === 'healthy' && pythonCheck.extra?.interpreterPath) {
      result.push(await detectSystemPyTorch(String(pythonCheck.extra.interpreterPath)))
    }
    return result
  })()

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
    isMac
      ? Promise.resolve<DevEnvironmentCheck | null>(null)
      : detectCuda(),
    isMac
      ? Promise.resolve<DevEnvironmentCheck | null>(null)
      : detectNvidiaDriver(),
  ])

  const flat = checks.filter((entry): entry is DevEnvironmentCheck => entry !== null)
  return [...flat, ...(await pythonAndTorch)]
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
    const { stdout } = await runExternalCommand(interpreterPath, ['-c', script], { timeout: 6000, maxBuffer: 4 * 1024 * 1024 })
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
