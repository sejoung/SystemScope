export const RESPONSIVE_WIDTH = {
  installedAppsCompact: 980,
  leftoverAppsCompact: 1080,
  listeningPortsCompact: 1120,
  registryAppsCompact: 1040,
  processTableCompact: 980,
  portWatchCompact: 960,
  dockerPageCompact: 980,
  settingsPageCompact: 920,
} as const

export function isCompactWidth(width: number, threshold: number): boolean {
  return width < threshold
}
