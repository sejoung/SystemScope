import { useState } from 'react'
import type { ProcessInfo, ProcessKillResult } from '@shared/types'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../i18n/useI18n'

export function useManualProcessTermination(reason: string) {
  const showToast = useToast((state) => state.show)
  const { tk } = useI18n()
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null)

  const requestTermination = async (
    processInfo: ProcessInfo,
    tree: boolean
  ): Promise<void> => {
    if (terminatingPid !== null) return

    setTerminatingPid(processInfo.pid)
    try {
      const response = await window.systemScope.killProcess({
        pid: processInfo.pid,
        name: processInfo.name,
        command: processInfo.command,
        reason,
        tree
      })

      if (!response.ok) {
        showToast(response.error?.message ?? tk('process.table.kill_failed'))
        return
      }

      const result = response.data as ProcessKillResult
      if (result.cancelled) return
      if (result.killed) {
        const descendants = result.killedPids.length - 1
        showToast(
          descendants > 0
            ? tk('process.table.kill_tree_sent', {
                name: result.name,
                count: descendants
              })
            : tk('process.table.kill_sent', {
                name: result.name,
                pid: result.pid
              })
        )
      }
    } finally {
      setTerminatingPid(null)
    }
  }

  return {
    terminatingPid,
    requestTermination
  }
}
