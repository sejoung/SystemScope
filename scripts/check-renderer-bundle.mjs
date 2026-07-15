import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const MAX_ENTRY_BYTES = 900 * 1024
const MAX_INITIAL_DASHBOARD_BYTES = 1100 * 1024
const indexPath = resolve('out/renderer/index.html')
const html = await readFile(indexPath, 'utf-8')
const match = /<script[^>]+src="\.\/(assets\/index-[^"]+\.js)"/.exec(html)

if (!match) {
  throw new Error(`Renderer entry script was not found in ${indexPath}`)
}

const entryPath = resolve('out/renderer', match[1])
const { size } = await stat(entryPath)
if (size > MAX_ENTRY_BYTES) {
  throw new Error(`Renderer entry is ${size} bytes; budget is ${MAX_ENTRY_BYTES} bytes.`)
}

const assetsDir = dirname(entryPath)
const entryAsset = match[1].split('/').pop()
const dashboardAsset = (await readdir(assetsDir)).find((fileName) => /^DashboardPage-.*\.js$/.test(fileName))
if (!dashboardAsset) throw new Error('Dashboard page chunk was not found.')

const dashboardAssets = new Set()
async function collectStaticImports(fileName) {
  if (fileName === entryAsset) return
  if (dashboardAssets.has(fileName)) return
  dashboardAssets.add(fileName)
  const source = await readFile(resolve(assetsDir, fileName), 'utf-8')
  const importPattern = /(?:\b(?:import|export)[^'"`;]*?from|\bimport)\s*["']\.\/([^"']+\.js)["']/g
  for (const dependency of source.matchAll(importPattern)) {
    await collectStaticImports(dependency[1])
  }
}

await collectStaticImports(dashboardAsset)
let dashboardBytes = 0
for (const fileName of dashboardAssets) dashboardBytes += (await stat(resolve(assetsDir, fileName))).size
const initialDashboardBytes = size + dashboardBytes
if (initialDashboardBytes > MAX_INITIAL_DASHBOARD_BYTES) {
  throw new Error(`Initial dashboard route is ${initialDashboardBytes} bytes; budget is ${MAX_INITIAL_DASHBOARD_BYTES} bytes.`)
}

console.log(`Renderer entry size: ${size} / ${MAX_ENTRY_BYTES} bytes`)
console.log(`Initial dashboard route: ${initialDashboardBytes} / ${MAX_INITIAL_DASHBOARD_BYTES} bytes`)
