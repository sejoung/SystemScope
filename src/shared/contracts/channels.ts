export const IPC_CHANNELS = {
  // 앱
  APP_LOG_RENDERER_ERROR: 'app:logRendererError',
  APP_SET_UNSAVED_SETTINGS: 'app:setUnsavedSettings',
  APP_GET_ABOUT_INFO: 'app:getAboutInfo',
  APP_OPEN_ABOUT: 'app:openAbout',
  APP_OPEN_HOMEPAGE: 'app:openHomepage',
  UPDATE_CHECK: 'update:check',
  UPDATE_GET_STATUS: 'update:getStatus',
  UPDATE_OPEN_RELEASE: 'update:openRelease',

  // 시스템 모니터링
  SYSTEM_GET_STATS: 'system:getStats',
  SYSTEM_SUBSCRIBE: 'system:subscribe',
  SYSTEM_UNSUBSCRIBE: 'system:unsubscribe',

  // 디스크 분석
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
  DISK_TRASH_ITEMS: 'disk:trashItems',

  // Docker 관리
  DOCKER_LIST_IMAGES: 'docker:listImages',
  DOCKER_REMOVE_IMAGES: 'docker:removeImages',
  DOCKER_LIST_CONTAINERS: 'docker:listContainers',
  DOCKER_REMOVE_CONTAINERS: 'docker:removeContainers',
  DOCKER_STOP_CONTAINERS: 'docker:stopContainers',
  DOCKER_LIST_VOLUMES: 'docker:listVolumes',
  DOCKER_REMOVE_VOLUMES: 'docker:removeVolumes',
  DOCKER_GET_BUILD_CACHE: 'docker:getBuildCache',
  DOCKER_PRUNE_BUILD_CACHE: 'docker:pruneBuildCache',

  // 프로세스 모니터링
  PROCESS_GET_TOP_CPU: 'process:getTopCpu',
  PROCESS_GET_TOP_MEMORY: 'process:getTopMemory',
  PROCESS_GET_ALL: 'process:getAll',
  PROCESS_GET_SNAPSHOT: 'process:getSnapshot',
  PROCESS_GET_PORTS: 'process:getPorts',
  PROCESS_KILL: 'process:kill',

  // 설치된 앱
  APPS_LIST_INSTALLED: 'apps:listInstalled',
  APPS_GET_RELATED_DATA: 'apps:getRelatedData',
  APPS_LIST_LEFTOVER_DATA: 'apps:listLeftoverData',
  APPS_HYDRATE_LEFTOVER_SIZES: 'apps:hydrateLeftoverSizes',
  APPS_REMOVE_LEFTOVER_DATA: 'apps:removeLeftoverData',
  APPS_LIST_LEFTOVER_REGISTRY: 'apps:listLeftoverRegistry',
  APPS_REMOVE_LEFTOVER_REGISTRY: 'apps:removeLeftoverRegistry',
  APPS_UNINSTALL: 'apps:uninstall',
  APPS_OPEN_LOCATION: 'apps:openLocation',
  APPS_OPEN_SYSTEM_SETTINGS: 'apps:openSystemSettings',

  // 알림
  ALERT_GET_ACTIVE: 'alert:getActive',
  ALERT_DISMISS: 'alert:dismiss',

  // 작업
  JOB_CANCEL: 'job:cancel',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',

  // 설정
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_DATA_PATH: 'settings:getDataPath',
  SETTINGS_GET_SYSTEM_LOG_PATH: 'settings:getSystemLogPath',
  SETTINGS_GET_ACCESS_LOG_PATH: 'settings:getAccessLogPath',

  // 다이얼로그
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',

  // 셸 (Finder / 탐색기)
  SHELL_SHOW_IN_FOLDER: 'shell:showInFolder',
  SHELL_OPEN_PATH: 'shell:openPath',

  // 타임라인
  TIMELINE_GET_DATA: 'timeline:getData',
  TIMELINE_GET_POINT_DETAIL: 'timeline:getPointDetail',

  // 이벤트 히스토리
  EVENT_GET_HISTORY: 'event:getHistory',
  EVENT_GET_RECENT: 'event:getRecent',

  // 실시간 이벤트 (메인 → 렌더러)
  EVENT_SYSTEM_UPDATE: 'event:systemUpdate',
  EVENT_ALERT_FIRED: 'event:alertFired',
  EVENT_SHUTDOWN_STATE: 'event:shutdownState',
  EVENT_UPDATE_AVAILABLE: 'event:updateAvailable'
} as const
