import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

describe('IPC_CHANNELS', () => {
  it('should have namespace format for all channels', () => {
    for (const [, value] of Object.entries(IPC_CHANNELS)) {
      expect(value).toMatch(/^[a-z]+:[a-zA-Z]+$/)
    }
  })

  it('should have unique channel names', () => {
    const values = Object.values(IPC_CHANNELS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('should contain all system channels', () => {
    expect(IPC_CHANNELS.APP_LOG_RENDERER_ERROR).toBeDefined()
    expect(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS).toBeDefined()
    expect(IPC_CHANNELS.SYSTEM_GET_STATS).toBeDefined()
    expect(IPC_CHANNELS.SYSTEM_SUBSCRIBE).toBeDefined()
    expect(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE).toBeDefined()
  })

  it('should contain all disk channels', () => {
    expect(IPC_CHANNELS.DISK_SCAN_FOLDER).toBeDefined()
    expect(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE).toBeDefined()
    expect(IPC_CHANNELS.DISK_GET_LARGE_FILES).toBeDefined()
    expect(IPC_CHANNELS.DISK_GET_EXTENSIONS).toBeDefined()
    expect(IPC_CHANNELS.DISK_QUICK_SCAN).toBeDefined()
    expect(IPC_CHANNELS.DISK_USER_SPACE).toBeDefined()
    expect(IPC_CHANNELS.DISK_RECENT_GROWTH).toBeDefined()
    expect(IPC_CHANNELS.DISK_FIND_DUPLICATES).toBeDefined()
    expect(IPC_CHANNELS.DISK_GROWTH_VIEW).toBeDefined()
    expect(IPC_CHANNELS.DISK_LIST_DOCKER_IMAGES).toBeDefined()
    expect(IPC_CHANNELS.DISK_REMOVE_DOCKER_IMAGES).toBeDefined()
    expect(IPC_CHANNELS.DISK_LIST_DOCKER_CONTAINERS).toBeDefined()
    expect(IPC_CHANNELS.DISK_REMOVE_DOCKER_CONTAINERS).toBeDefined()
    expect(IPC_CHANNELS.DISK_STOP_DOCKER_CONTAINERS).toBeDefined()
    expect(IPC_CHANNELS.DISK_LIST_DOCKER_VOLUMES).toBeDefined()
    expect(IPC_CHANNELS.DISK_REMOVE_DOCKER_VOLUMES).toBeDefined()
    expect(IPC_CHANNELS.DISK_GET_DOCKER_BUILD_CACHE).toBeDefined()
    expect(IPC_CHANNELS.DISK_PRUNE_DOCKER_BUILD_CACHE).toBeDefined()
  })

  it('should contain all process channels', () => {
    expect(IPC_CHANNELS.PROCESS_GET_TOP_CPU).toBeDefined()
    expect(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY).toBeDefined()
    expect(IPC_CHANNELS.PROCESS_GET_ALL).toBeDefined()
    expect(IPC_CHANNELS.PROCESS_GET_PORTS).toBeDefined()
    expect(IPC_CHANNELS.PROCESS_KILL).toBeDefined()
  })

  it('should contain all apps channels', () => {
    expect(IPC_CHANNELS.APPS_LIST_INSTALLED).toBeDefined()
    expect(IPC_CHANNELS.APPS_UNINSTALL).toBeDefined()
    expect(IPC_CHANNELS.APPS_OPEN_LOCATION).toBeDefined()
    expect(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS).toBeDefined()
  })

  it('should contain all alert channels', () => {
    expect(IPC_CHANNELS.ALERT_GET_ACTIVE).toBeDefined()
    expect(IPC_CHANNELS.ALERT_DISMISS).toBeDefined()
  })

  it('should contain all job channels', () => {
    expect(IPC_CHANNELS.JOB_CANCEL).toBeDefined()
    expect(IPC_CHANNELS.JOB_PROGRESS).toBeDefined()
    expect(IPC_CHANNELS.JOB_COMPLETED).toBeDefined()
    expect(IPC_CHANNELS.JOB_FAILED).toBeDefined()
  })

  it('should contain all settings channels', () => {
    expect(IPC_CHANNELS.SETTINGS_GET).toBeDefined()
    expect(IPC_CHANNELS.SETTINGS_SET).toBeDefined()
    expect(IPC_CHANNELS.SETTINGS_GET_DATA_PATH).toBeDefined()
    expect(IPC_CHANNELS.SETTINGS_GET_LOG_PATH).toBeDefined()
  })

  it('should contain all dialog and shell channels', () => {
    expect(IPC_CHANNELS.DIALOG_SELECT_FOLDER).toBeDefined()
    expect(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER).toBeDefined()
    expect(IPC_CHANNELS.SHELL_OPEN_PATH).toBeDefined()
  })

  it('should contain all event channels', () => {
    expect(IPC_CHANNELS.EVENT_SYSTEM_UPDATE).toBeDefined()
    expect(IPC_CHANNELS.EVENT_ALERT_FIRED).toBeDefined()
  })
})
