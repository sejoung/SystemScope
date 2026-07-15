const publicEntryFolders = [
  ['main-ipc-disk', 'src/main/ipc/disk'],
  ['main-ipc-docker', 'src/main/ipc/docker'],
  ['renderer-apps-installed', 'src/renderer/src/features/apps/installed'],
  ['renderer-apps-leftover', 'src/renderer/src/features/apps/leftover'],
  ['renderer-apps-registry', 'src/renderer/src/features/apps/registry'],
  ['renderer-devtools-overview', 'src/renderer/src/features/devtools/overview'],
  ['renderer-process-listening-ports', 'src/renderer/src/features/process/listeningPorts'],
  ['renderer-process-network', 'src/renderer/src/features/process/network'],
  ['renderer-process-port-watch', 'src/renderer/src/features/process/portWatch'],
  ['renderer-process-table', 'src/renderer/src/features/process/processTable'],
  ['shared-locale-en', 'src/shared/i18n/locales/en'],
  ['shared-locale-ko', 'src/shared/i18n/locales/ko']
]

const publicEntryRules = publicEntryFolders.map(([name, folder]) => ({
  name: `${name}-uses-public-entry`,
  severity: 'error',
  comment: `Modules outside ${folder} must import its index.ts public entry.`,
  from: { pathNot: `^${folder}/` },
  to: {
    path: `^${folder}/`,
    pathNot: `^${folder}/index\\.[cm]?[jt]sx?$`
  }
}))

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment: 'Modules must form a directed acyclic graph.',
      from: {},
      to: { circular: true }
    },
    {
      name: 'shared-is-runtime-independent',
      severity: 'error',
      comment: 'Shared code is the foundation and cannot depend on an Electron runtime.',
      from: { path: '^src/shared/' },
      to: { path: '^src/(main|preload|renderer)/' }
    },
    {
      name: 'main-isolated-from-browser-runtimes',
      severity: 'error',
      comment: 'The Electron main process cannot import preload or renderer implementation.',
      from: { path: '^src/main/' },
      to: { path: '^src/(preload|renderer)/' }
    },
    {
      name: 'preload-is-an-isolated-bridge',
      severity: 'error',
      comment: 'Preload may expose shared contracts but cannot import main or renderer implementation.',
      from: { path: '^src/preload/' },
      to: { path: '^src/(main|renderer)/' }
    },
    {
      name: 'renderer-isolated-from-node-runtimes',
      severity: 'error',
      comment: 'Renderer code can use shared contracts only, never main or preload implementation.',
      from: { path: '^src/renderer/' },
      to: { path: '^src/(main|preload)/' }
    },
    {
      name: 'main-services-do-not-depend-on-delivery',
      severity: 'error',
      comment: 'Domain services must not depend on Electron app or IPC delivery layers.',
      from: { path: '^src/main/services/' },
      to: { path: '^src/main/(app|ipc)/' }
    },
    {
      name: 'renderer-components-do-not-depend-on-features',
      severity: 'error',
      comment: 'Reusable renderer components cannot depend on features or pages.',
      from: { path: '^src/renderer/src/components/' },
      to: { path: '^src/renderer/src/(features|pages)/' }
    },
    {
      name: 'renderer-features-do-not-depend-on-pages',
      severity: 'error',
      comment: 'Features are composed by pages and cannot import pages.',
      from: { path: '^src/renderer/src/features/' },
      to: { path: '^src/renderer/src/pages/' }
    },
    ...publicEntryRules,
    {
      name: 'settings-internals-use-page-facade',
      severity: 'error',
      comment: 'Settings internals are private to the settings folder and SettingsPage facade.',
      from: {
        pathNot: '^src/renderer/src/pages/(?:settings/|SettingsPage\\.tsx$)'
      },
      to: { path: '^src/renderer/src/pages/settings/' }
    },
    {
      name: 'devtools-overview-internals-use-service-facade',
      severity: 'error',
      comment: 'DevTools overview internals are private to the overview folder and devToolsOverview facade.',
      from: {
        pathNot: '^src/main/services/devtools/(?:overview/|devToolsOverview\\.ts$)'
      },
      to: { path: '^src/main/services/devtools/overview/' }
    },
    {
      name: 'no-unresolvable-project-imports',
      severity: 'error',
      comment: 'All project imports must resolve through files or declared TypeScript aliases.',
      from: { path: '^src/' },
      to: { couldNotResolve: true }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: { path: '^src/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: 'specify',
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    }
  }
}
