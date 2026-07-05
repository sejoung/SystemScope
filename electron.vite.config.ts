import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const root = __dirname
const mainRoot = resolve(root, 'src/main')
const rendererRoot = resolve(root, 'src/renderer/src')
const sharedRoot = resolve(root, 'src/shared')

// `electron-vite build --mode e2e` opts the preload bundle into the E2E test mock.
// In any other mode (production / release) __E2E__ is false, so the mock import is
// dead-code-eliminated and never ships in the packaged app.
export default defineConfig(({ mode }) => ({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(root, 'src/main/app/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      rollupOptions: {
        external: ['electron', 'systeminformation', 'electron-log', 'electron-store']
      }
    },
    resolve: {
      alias: {
        '@shared': sharedRoot,
        '@main': mainRoot
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __E2E__: JSON.stringify(mode === 'e2e')
    },
    build: {
      lib: {
        entry: resolve(root, 'src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      rollupOptions: {
        external: ['electron']
      }
    },
    resolve: {
      alias: {
        '@shared': sharedRoot
      }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@shared': sharedRoot,
        '@': rendererRoot
      }
    },
    plugins: [react()]
  }
}))
