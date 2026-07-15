import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DevWorkspacePythonEnv, DevWorkspacePythonEnvType } from '@shared/types'
import { extractVersion, pathExists } from './devServerDetection'

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

export async function detectWorkspacePythonEnv(workspacePath: string): Promise<DevWorkspacePythonEnv | null> {
  const candidate = await findWorkspacePythonInterpreter(workspacePath)
  if (!candidate) return null

  // SECURITY: never execute an interpreter discovered by scanning a workspace tree —
  // a hostile/cloned repo could ship a malicious `venv/bin/python`. Detect Python and
  // PyTorch statically from on-disk metadata (pyvenv.cfg, conda-meta, torch/version.py)
  // instead of running the binary. Only the PATH-resolved system Python is executed.
  const pythonVersion = await readWorkspacePythonVersion(candidate)
  const torch = await readWorkspaceTorchInfo(candidate)

  const base = {
    envType: candidate.envType,
    envPath: candidate.envPath,
    interpreterPath: candidate.interpreterPath,
    pythonVersion,
  }

  if (torch?.version) {
    return {
      ...base,
      torchVersion: torch.version,
      // Statically derived: reflects whether the wheel was built with CUDA, not a
      // live torch.cuda.is_available() check (which would require executing torch).
      torchCudaAvailable: torch.cudaBuild,
      detectionNote: 'Detected statically (interpreter not executed).',
    }
  }

  return {
    ...base,
    torchVersion: null,
    torchCudaAvailable: null,
    detectionNote: 'PyTorch not detected in this environment.',
  }
}

// Reads the Python version without executing the interpreter: from pyvenv.cfg for
// venvs, or the python package record filename in conda-meta for conda envs.
export async function readWorkspacePythonVersion(candidate: PythonEnvCandidate): Promise<string | null> {
  if (!candidate.envPath) return null
  if (candidate.envType === 'venv') {
    try {
      const cfg = await fs.readFile(path.join(candidate.envPath, 'pyvenv.cfg'), 'utf-8')
      const match = cfg.match(/^\s*version(?:_info)?\s*=\s*(.+?)\s*$/im)
      return match ? extractVersion(match[1]) ?? match[1] : null
    } catch {
      return null
    }
  }
  try {
    const metas = await fs.readdir(path.join(candidate.envPath, 'conda-meta'))
    const record = metas.find((name) => /^python-\d+\.\d+\.\d+/.test(name))
    const match = record?.match(/^python-(\d+\.\d+\.\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// Locates site-packages/torch/version.py and parses it statically — no execution.
export async function readWorkspaceTorchInfo(
  candidate: PythonEnvCandidate
): Promise<{ version: string | null; cudaBuild: boolean | null } | null> {
  if (!candidate.envPath) return null
  for (const sitePackages of await resolveSitePackagesDirs(candidate.envPath)) {
    try {
      const content = await fs.readFile(path.join(sitePackages, 'torch', 'version.py'), 'utf-8')
      const versionMatch = content.match(/__version__\s*[:=]\s*['"]([^'"]+)['"]/)
      const cudaMatch = content.match(/\bcuda\b\s*(?::\s*[^=]+)?=\s*(None|['"][^'"]*['"])/)
      return {
        version: versionMatch ? versionMatch[1] : null,
        cudaBuild: cudaMatch ? cudaMatch[1] !== 'None' : null,
      }
    } catch {
      // Try the next candidate site-packages directory.
    }
  }
  return null
}

async function resolveSitePackagesDirs(envPath: string): Promise<string[]> {
  if (process.platform === 'win32') {
    return [path.join(envPath, 'Lib', 'site-packages')]
  }
  const libDir = path.join(envPath, 'lib')
  try {
    const entries = await fs.readdir(libDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('python'))
      .map((entry) => path.join(libDir, entry.name, 'site-packages'))
  } catch {
    return []
  }
}
