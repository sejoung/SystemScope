import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const MAX_ENTRY_BYTES = 900 * 1024
const MAX_INITIAL_DASHBOARD_BYTES = 1100 * 1024
const MAX_TIMELINE_ROUTE_BYTES = 200 * 1024
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
const assetNames = await readdir(assetsDir)
const dashboardAsset = assetNames.find((fileName) => /^DashboardPage-.*\.js$/.test(fileName))
if (!dashboardAsset) throw new Error('Dashboard page chunk was not found.')

async function collectRouteBytes(routeAsset) {
  const routeAssets = new Set()
  await collectStaticImports(routeAsset, routeAssets)
  let routeBytes = 0
  for (const fileName of routeAssets) routeBytes += (await stat(resolve(assetsDir, fileName))).size
  return routeBytes
}

async function collectStaticImports(fileName, collectedAssets) {
  if (fileName === entryAsset) return
  if (collectedAssets.has(fileName)) return
  collectedAssets.add(fileName)
  const source = await readFile(resolve(assetsDir, fileName), 'utf-8')
  const importPattern = /(?:\b(?:import|export)[^'"`;]*?from|\bimport)\s*["']\.\/([^"']+\.js)["']/g
  for (const dependency of source.matchAll(importPattern)) {
    await collectStaticImports(dependency[1], collectedAssets)
  }
}

const dashboardBytes = await collectRouteBytes(dashboardAsset)
const initialDashboardBytes = size + dashboardBytes
if (initialDashboardBytes > MAX_INITIAL_DASHBOARD_BYTES) {
  throw new Error(`Initial dashboard route is ${initialDashboardBytes} bytes; budget is ${MAX_INITIAL_DASHBOARD_BYTES} bytes.`)
}

const timelineAsset = assetNames.find((fileName) => /^TimelinePage-.*\.js$/.test(fileName))
if (!timelineAsset) throw new Error('Timeline page chunk was not found.')
const timelineRouteBytes = await collectRouteBytes(timelineAsset)
if (timelineRouteBytes > MAX_TIMELINE_ROUTE_BYTES) {
  throw new Error(`Timeline route is ${timelineRouteBytes} bytes; budget is ${MAX_TIMELINE_ROUTE_BYTES} bytes.`)
}

console.log(`Renderer entry size: ${size} / ${MAX_ENTRY_BYTES} bytes`)
console.log(`Initial dashboard route: ${initialDashboardBytes} / ${MAX_INITIAL_DASHBOARD_BYTES} bytes`)
console.log(`Timeline route: ${timelineRouteBytes} / ${MAX_TIMELINE_ROUTE_BYTES} bytes`)
