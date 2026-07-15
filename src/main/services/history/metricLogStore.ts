import type { MetricPoint } from '@shared/types/metric'
import { AppendOnlyLogStore } from '@main/services/core/appendOnlyLogStore'

export class MetricLogStore extends AppendOnlyLogStore<MetricPoint> {
  constructor(filePath: string, legacyFilePath: string, maxAgeMs: number) {
    super({
      filePath,
      legacyFilePath,
      maxAgeMs,
      getTimestamp: (entry) => entry.ts,
      logScope: 'metric-log-store',
    })
  }
}
