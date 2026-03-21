export const IPC_CHANNELS = {
  // System Monitoring
  SYSTEM_GET_STATS: 'system:getStats',
  SYSTEM_SUBSCRIBE: 'system:subscribe',
  SYSTEM_UNSUBSCRIBE: 'system:unsubscribe',

  // Disk Analysis
  DISK_SCAN_FOLDER: 'disk:scanFolder',
  DISK_GET_LARGE_FILES: 'disk:getLargeFiles',
  DISK_GET_EXTENSIONS: 'disk:getExtensions',
  DISK_QUICK_SCAN: 'disk:quickScan',
  DISK_USER_SPACE: 'disk:userSpace',
  DISK_RECENT_GROWTH: 'disk:recentGrowth',
  DISK_FIND_DUPLICATES: 'disk:findDuplicates',
  DISK_GROWTH_VIEW: 'disk:growthView',

  // Process Monitoring
  PROCESS_GET_TOP_CPU: 'process:getTopCpu',
  PROCESS_GET_TOP_MEMORY: 'process:getTopMemory',

  // Alerts
  ALERT_GET_ACTIVE: 'alert:getActive',
  ALERT_UPDATE_THRESHOLDS: 'alert:updateThresholds',
  ALERT_DISMISS: 'alert:dismiss',

  // Jobs
  JOB_CANCEL: 'job:cancel',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_DATA_PATH: 'settings:getDataPath',

  // Dialog
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',

  // Shell (Finder / Explorer)
  SHELL_SHOW_IN_FOLDER: 'shell:showInFolder',
  SHELL_OPEN_PATH: 'shell:openPath',

  // Real-time events (main → renderer)
  EVENT_SYSTEM_UPDATE: 'event:systemUpdate',
  EVENT_ALERT_FIRED: 'event:alertFired'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
