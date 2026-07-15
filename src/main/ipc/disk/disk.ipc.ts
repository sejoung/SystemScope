import { registerDiskAnalysisIpc } from './diskAnalysis.ipc'
import { registerDiskScanIpc } from './diskScan.ipc'
import { registerDiskTrashIpc } from './diskTrash.ipc'

export function registerDiskIpc(): void { registerDiskScanIpc(); registerDiskAnalysisIpc(); registerDiskTrashIpc() }
