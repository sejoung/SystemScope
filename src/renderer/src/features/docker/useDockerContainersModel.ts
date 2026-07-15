import { useEffect, useMemo, useState } from 'react'
import type { DockerActionResult, DockerContainerSummary, DockerContainersScanResult, DockerRemoveResult } from '@shared/types'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../i18n/useI18n'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../hooks/useResponsiveLayout'

export function shouldUseDockerContainersCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.dockerPageCompact) }

export function useDockerContainersModel(refreshToken: number, onChanged?: () => void) {
  const [containerRef, containerWidth] = useContainerWidth(1100)
  const showToast = useToast((s) => s.show)
  const { tk } = useI18n()
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<DockerContainerSummary[]>([])
  const [status, setStatus] = useState<DockerContainersScanResult['status']>('ready')
  const [message, setMessage] = useState<string | null>(tk('docker.containers.initial'))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const removableContainers = useMemo(() => containers.filter((container) => !container.running), [containers])
  const runningContainers = useMemo(() => containers.filter((container) => container.running), [containers])
  const selectedRemovableCount = useMemo(
    () => removableContainers.filter((container) => selectedIds.has(container.id)).length,
    [removableContainers, selectedIds]
  )
  const allRemovableChecked = removableContainers.length > 0 && selectedRemovableCount === removableContainers.length
  const compactLayout = shouldUseDockerContainersCompactLayout(containerWidth)

  const scanContainers = async () => {
    setLoading(true)
    const res = await window.systemScope.listDockerContainers()
    if (!res.ok) {
      setStatus('daemon_unavailable')
      setContainers([])
      setMessage(res.error?.message ?? tk('docker.containers.load_failed'))
      setLoading(false)
      return
    }
    if (!res.data) {
      setLoading(false)
      return
    }

    const data = res.data as DockerContainersScanResult
    setStatus(data.status)
    setContainers(data.containers)
    setMessage(data.message)
    setSelectedIds(new Set())
    setLoading(false)
  }

  useEffect(() => {
    void scanContainers()
  }, [refreshToken])

  const handleDelete = async (ids: string[]) => {
    const res = await window.systemScope.removeDockerContainers(ids)
    if (!res.ok) {
      showToast(res.error?.message ?? tk('docker.containers.delete_failed'))
      return
    }
    if (!res.data) return

    const result = res.data as DockerRemoveResult
    if (result.cancelled) return

    if (result.deletedIds.length > 0) {
      showToast(tk('docker.containers.deleted', { count: result.deletedIds.length }))
      setContainers((prev) => prev.filter((container) => !result.deletedIds.includes(container.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        result.deletedIds.forEach((id) => next.delete(id))
        return next
      })
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(tk('docker.containers.partial', { message: result.errors[0] }))
    }
  }

  const handleStop = async (ids: string[]) => {
    const res = await window.systemScope.stopDockerContainers(ids)
    if (!res.ok) {
      showToast(res.error?.message ?? tk('docker.containers.stop_failed'))
      return
    }
    if (!res.data) return

    const result = res.data as DockerActionResult
    if (result.cancelled) return

    if (result.affectedIds.length > 0) {
      showToast(tk('docker.containers.stopped', { count: result.affectedIds.length }))
      setContainers((prev) =>
        prev.map((container) =>
          result.affectedIds.includes(container.id)
            ? { ...container, running: false, status: tk('docker.containers.stopped_by_app') }
            : container
        )
      )
      onChanged?.()
    }
    if (result.failCount > 0 && result.errors.length > 0) {
      showToast(tk('docker.containers.partial', { message: result.errors[0] }))
    }
  }


  return { containerRef, tk, loading, containers, status, message, selectedIds, setSelectedIds, removableContainers, runningContainers, selectedRemovableCount, allRemovableChecked, compactLayout, scanContainers, handleDelete, handleStop }
}
