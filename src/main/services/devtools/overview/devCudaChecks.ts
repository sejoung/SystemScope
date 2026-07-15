import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DevEnvironmentCheck } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from '@main/services/core/externalCommand'
import { extractVersion } from './devServerDetection'

export async function detectCuda(): Promise<DevEnvironmentCheck> {
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

export async function detectNvidiaDriver(): Promise<DevEnvironmentCheck> {
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
