import { nativeImage, nativeTheme } from 'electron'
import log from 'electron-log'

type TrayPlatform = 'darwin' | 'win32' | 'other'

interface TrayVisualState {
  level: 0 | 1 | 2 | 3 | 4
  pulse: boolean
  platform: TrayPlatform
  darkTaskbar: boolean
}

export function getCpuLevel(usage: number): TrayVisualState['level'] {
  if (usage >= 90) return 4
  if (usage >= 75) return 3
  if (usage >= 50) return 2
  if (usage >= 25) return 1
  return 0
}

export function renderTraySvg({ level, pulse, platform, darkTaskbar }: TrayVisualState): string {
  const isMac = platform === 'darwin'
  const isWinLight = !isMac && !darkTaskbar
  const size = 24
  const baseColor = isMac ? '#000000' : isWinLight ? '#1e293b' : '#dbeafe'
  const ringColor = isMac ? '#000000' : isWinLight ? '#0284c7' : '#38bdf8'
  const pulseColor = isMac ? '#000000' : level >= 4 ? '#ef4444' : '#f59e0b'
  const shellOpacity = isMac ? 0.92 : 1
  const quietBarOpacity = isMac ? 0.2 : 0.25
  const activeBarOpacity = isMac ? 0.95 : 1
  const ringOpacity = isMac ? 0.75 : 0.95
  const radarLineOpacity = isMac ? 0.95 : 1
  const pulseOpacity = pulse ? (isMac ? 1 : 0.95) : (isMac ? 0.6 : 0.75)
  const bars = [
    { x: 4.5, y: 18, width: 2.2, height: 2.5, active: level >= 1 },
    { x: 7.8, y: 16.3, width: 2.2, height: 4.2, active: level >= 2 },
    { x: 11.1, y: 14.4, width: 2.2, height: 6.1, active: level >= 3 },
    { x: 14.4, y: 12.3, width: 2.2, height: 8.2, active: level >= 4 }
  ]

  const activeBarColor = pulse && level >= 3 ? pulseColor : baseColor

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      <g fill="none" fill-rule="evenodd">
        <circle cx="12" cy="10" r="5.6" stroke="${ringColor}" stroke-width="1.8" opacity="${ringOpacity}" />
        <circle cx="12" cy="10" r="1.15" fill="${baseColor}" opacity="${shellOpacity}" />
        <line x1="12" y1="10" x2="16.4" y2="7.2" stroke="${ringColor}" stroke-width="1.8" stroke-linecap="round" opacity="${radarLineOpacity}" />
        <circle cx="15.9" cy="8.3" r="0.8" fill="${baseColor}" opacity="${shellOpacity}" />
        <circle cx="10.3" cy="13.2" r="0.65" fill="${baseColor}" opacity="${isMac ? 0.55 : 0.7}" />
        ${bars
          .map(
            (bar) => `
              <rect
                x="${bar.x}"
                y="${bar.y}"
                width="${bar.width}"
                height="${bar.height}"
                rx="0.7"
                fill="${bar.active ? activeBarColor : baseColor}"
                opacity="${bar.active ? activeBarOpacity : quietBarOpacity}"
              />
            `
          )
          .join('')}
        ${
          level >= 3
            ? `<circle cx="19.4" cy="4.8" r="1.6" fill="${pulseColor}" opacity="${pulseOpacity}" />`
            : ''
        }
      </g>
    </svg>
  `.trim()
}

export function createTrayImage(usage: number, pulse: boolean, processPlatform: NodeJS.Platform): Electron.NativeImage {
  const platform: TrayPlatform =
    processPlatform === 'darwin' ? 'darwin' : processPlatform === 'win32' ? 'win32' : 'other'

  try {
    const svg = renderTraySvg({
      level: getCpuLevel(usage),
      pulse,
      platform,
      darkTaskbar: nativeTheme.shouldUseDarkColors
    })
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    const icon = nativeImage.createFromDataURL(dataUrl).resize({
      width: platform === 'darwin' ? 18 : 16,
      height: platform === 'darwin' ? 18 : 16
    })

    if (platform === 'darwin') {
      icon.setTemplateImage(true)
    }

    return icon
  } catch (err) {
    log.error('Failed to create tray image, using empty fallback', err)
    return nativeImage.createEmpty()
  }
}

export function getCpuMeterText(usage: number, pulse: boolean): string {
  const level = getCpuLevel(usage)
  const active = pulse && level >= 3 ? '▣' : '■'
  const inactive = '□'
  return `[${Array.from({ length: 4 }, (_, index) => (index < level ? active : inactive)).join('')}]`
}
