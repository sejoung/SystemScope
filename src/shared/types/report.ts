export interface ReportSections {
  systemSummary: boolean
  recentHistory: boolean
  activeAlerts: boolean
  topProcesses: boolean
  diskCleanup: boolean
  dockerReclaim: boolean
  diagnosis: boolean
}

export interface ReportOptions {
  sections: ReportSections
  maskSensitivePaths: boolean
}

export interface DiagnosticReportData {
  generatedAt: number
  appVersion: string
  platform: string
  arch: string
  sections: DiagnosticReportSection[]
}

export interface DiagnosticReportSection {
  key: keyof ReportSections
  title: string
  content: string
  data: unknown
}

export interface SaveReportOptions {
  report: DiagnosticReportData
  format: 'markdown' | 'json'
}
