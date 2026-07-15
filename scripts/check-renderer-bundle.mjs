import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const MAX_ENTRY_BYTES = 900 * 1024
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

console.log(`Renderer entry size: ${size} / ${MAX_ENTRY_BYTES} bytes`)
