export const IPC_CHANNELS = {
  // App
  APP_LOG_RENDERER_ERROR: 'app:logRendererError',
  APP_SET_UNSAVED_SETTINGS: 'app:setUnsavedSettings',

  // System Monitoring
  SYSTEM_GET_STATS: 'system:getStats',
  SYSTEM_SUBSCRIBE: 'system:subscribe',
  SYSTEM_UNSUBSCRIBE: 'system:unsubscribe',

  // Disk Analysis
  DISK_SCAN_FOLDER: 'disk:scanFolder',
  DISK_INVALIDATE_SCAN_CACHE: 'disk:invalidateScanCache',
  DISK_GET_LARGE_FILES: 'disk:getLargeFiles',
  DISK_GET_EXTENSIONS: 'disk:getExtensions',
  DISK_QUICK_SCAN: 'disk:quickScan',
  DISK_USER_SPACE: 'disk:userSpace',
  DISK_RECENT_GROWTH: 'disk:recentGrowth',
  DISK_FIND_DUPLICATES: 'disk:findDuplicates',
  DISK_GROWTH_VIEW: 'disk:growthView',
  DISK_FIND_OLD_FILES: 'disk:findOldFiles',
  DISK_LIST_DOCKER_IMAGES: 'disk:listDockerImages',
  DISK_REMOVE_DOCKER_IMAGES: 'disk:removeDockerImages',
  DISK_LIST_DOCKER_CONTAINERS: 'disk:listDockerContainers',
  DISK_REMOVE_DOCKER_CONTAINERS: 'disk:removeDockerContainers',
  DISK_STOP_DOCKER_CONTAINERS: 'disk:stopDockerContainers',
  DISK_LIST_DOCKER_VOLUMES: 'disk:listDockerVolumes',
  DISK_REMOVE_DOCKER_VOLUMES: 'disk:removeDockerVolumes',
  DISK_GET_DOCKER_BUILD_CACHE: 'disk:getDockerBuildCache',
  DISK_PRUNE_DOCKER_BUILD_CACHE: 'disk:pruneDockerBuildCache',

  // Process Monitoring
  PROCESS_GET_TOP_CPU: 'process:getTopCpu',
  PROCESS_GET_TOP_MEMORY: 'process:getTopMemory',
  PROCESS_GET_ALL: 'process:getAll',
  PROCESS_GET_PORTS: 'process:getPorts',
  PROCESS_KILL: 'process:kill',

  // Installed Apps
  APPS_LIST_INSTALLED: 'apps:listInstalled',
  APPS_UNINSTALL: 'apps:uninstall',
  APPS_OPEN_LOCATION: 'apps:openLocation',
  APPS_OPEN_SYSTEM_SETTINGS: 'apps:openSystemSettings',

  // Alerts
  ALERT_GET_ACTIVE: 'alert:getActive',
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
  SETTINGS_GET_LOG_PATH: 'settings:getLogPath',

  // Dialog
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',

  // Shell (Finder / Explorer)
  SHELL_SHOW_IN_FOLDER: 'shell:showInFolder',
  SHELL_OPEN_PATH: 'shell:openPath',
  SHELL_TRASH_ITEMS: 'shell:trashItems',

  // Real-time events (main → renderer)
  EVENT_SYSTEM_UPDATE: 'event:systemUpdate',
  EVENT_ALERT_FIRED: 'event:alertFired'
} as const
