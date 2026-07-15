import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DevWorkspaceInsight } from '@shared/types'
import { runExternalCommand } from '@main/services/core/externalCommand'
import { detectWorkspacePythonEnv } from './devWorkspacePython'
import { parseGitTimestamp, pathExists, pathExistsNearWorkspace, splitLines, summarizeGitStatusLines } from './devServerDetection'

const LARGE_UNTRACKED_FILE_BYTES = 5 * 1024 * 1024
const MAX_LARGE_UNTRACKED_FILES = 3
const DEV_ARTIFACT_DIRS = ['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.gradle', 'target', '.venv'] as const

export async function collectWorkspaceInsight(workspacePath: string): Promise<DevWorkspaceInsight> {
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
