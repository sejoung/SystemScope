import { describe, expect, it } from 'vitest'
import { parseBtmDump, mergeBtmRecords } from '../../src/main/services/startup/btm.mac'
import type { StartupItem } from '../../src/shared/types'

// Trimmed-down real `sfltool dumpbtm` output (macOS 26 format).
const SAMPLE_DUMP = `
========================
 Records for UID -2 : FFFFEEEE-DDDD-CCCC-BBBB-AAAAFFFFFFFE
========================

 ServiceManagement migrated: true
 LaunchServices registered: false

 Items:

 #1:
                 UUID: 7121AFB6-A1B8-462D-A119-9374F25CE814
                 Name: Docker
       Developer Name: Docker
                 Type: developer (0x20)
                Flags: [ curated ] (0x4)
          Disposition: [disabled, allowed, not notified] (0x2)
           Identifier: Docker
                  URL: (null)
           Generation: 0
  Embedded Item Identifiers:
    #1: 16.com.docker.vmnetd

 #2:
                 UUID: 9EBD8993-C074-453C-BBCA-9B131247C915
                 Name: com.docker.vmnetd
       Developer Name: Docker
      Team Identifier: 9BNSXJN65R
                 Type: legacy daemon (0x10010)
                Flags: [ legacy, curated ] (0x5)
          Disposition: [enabled, allowed, notified] (0xb)
           Identifier: com.docker.vmnetd
                  URL: file:///Library/LaunchDaemons/com.docker.vmnetd.plist
           Generation: 0

========================
 Records for UID 501 : AAAAAAAA-BBBB-CCCC-DDDD-EEEEFFFF0001
========================

 Items:

 #1:
                 UUID: 11111111-1111-1111-1111-111111111111
                 Name: ChatGPT
                 Type: app (0x2)
          Disposition: [disabled, allowed, not notified] (0x2)
           Identifier: com.openai.chat
                  URL: file:///Applications/ChatGPT.app/
           Generation: 1

 #2:
                 UUID: 22222222-2222-2222-2222-222222222222
                 Name: ChatGPTHelper
                 Type: agent (0x8)
          Disposition: [enabled, disallowed, notified] (0x9)
           Identifier: com.openai.chat-helper
                  URL: Contents/Library/LaunchAgents/com.openai.chat-helper.plist
           Generation: 1

 #3:
                 UUID: 33333333-3333-3333-3333-333333333333
                 Name: Rectangle
                 Type: app (0x2)
          Disposition: [enabled, allowed, not notified] (0x3)
           Identifier: com.knollsoft.Rectangle
                  URL: file:///Applications/Rectangle.app/
           Generation: 0

 #4:
                 UUID: 44444444-4444-4444-4444-444444444444
                 Name: RectangleLauncher
                 Type: login item (0x4)
          Disposition: [enabled, allowed, notified] (0xb)
           Identifier: com.knollsoft.RectangleLauncher
                  URL: Contents/Library/LoginItems/RectangleLauncher.app
           Generation: 0

 #5:
                 UUID: 55555555-5555-5555-5555-555555555555
                 Name: zoom.us
                 Type: legacy agent (0x10008)
          Disposition: [disabled, allowed, notified] (0xa)
           Identifier: us.zoom.updater
                  URL: file:///Library/LaunchAgents/us.zoom.updater.plist
           Generation: 0

 #6:
                 UUID: 66666666-6666-6666-6666-666666666666
                 Name: DockTilePlugin.plugin
                 Type: dock tile (0x80)
          Disposition: [enabled, allowed, notified] (0xb)
           Identifier: com.example.docktile
                  URL: Contents/PlugIns/DockTilePlugin.plugin
           Generation: 0
`

function plistItem(overrides: Partial<StartupItem>): StartupItem {
  return {
    id: 'x',
    name: 'x',
    path: '/x.plist',
    type: 'launch_agent',
    scope: 'user',
    enabled: true,
    label: null,
    description: null,
    ...overrides,
  }
}

describe('parseBtmDump', () => {
  const records = parseBtmDump(SAMPLE_DUMP)

  it('parses every record with UUID, name, type, and disposition', () => {
    expect(records).toHaveLength(8)
    const vmnetd = records.find((r) => r.name === 'com.docker.vmnetd')
    expect(vmnetd).toMatchObject({
      type: 'legacy daemon',
      enabled: true,
      sectionUid: -2,
      absolutePath: '/Library/LaunchDaemons/com.docker.vmnetd.plist',
    })
  })

  it('treats a leading "disabled" disposition as not enabled', () => {
    const zoom = records.find((r) => r.identifier === 'us.zoom.updater')
    expect(zoom?.enabled).toBe(false)
  })

  it('treats "disallowed" as off — that is how the System Settings toggle records OFF', () => {
    const helper = records.find((r) => r.name === 'ChatGPTHelper')
    expect(helper?.enabled).toBe(false)
  })

  it('resolves bundle-relative URLs against the preceding app record', () => {
    const helper = records.find((r) => r.name === 'ChatGPTHelper')
    expect(helper?.absolutePath).toBe('/Applications/ChatGPT.app/Contents/Library/LaunchAgents/com.openai.chat-helper.plist')
    const launcher = records.find((r) => r.name === 'RectangleLauncher')
    expect(launcher?.absolutePath).toBe('/Applications/Rectangle.app/Contents/Library/LoginItems/RectangleLauncher.app')
  })

  it('does not confuse embedded-item list entries with new records', () => {
    expect(records.filter((r) => r.uuid === '7121AFB6-A1B8-462D-A119-9374F25CE814')).toHaveLength(1)
  })
})

describe('mergeBtmRecords', () => {
  const records = parseBtmDump(SAMPLE_DUMP)

  it('overrides plist enabled state when System Settings disabled the item', () => {
    const items = [
      plistItem({ id: 'a', path: '/Library/LaunchAgents/us.zoom.updater.plist', enabled: true }),
      plistItem({ id: 'b', path: '/Library/LaunchDaemons/com.docker.vmnetd.plist', type: 'launch_daemon', scope: 'system', enabled: true }),
    ]
    const merged = mergeBtmRecords(items, records, 501)
    expect(merged.find((i) => i.id === 'a')?.enabled).toBe(false)
    expect(merged.find((i) => i.id === 'b')?.enabled).toBe(true)
  })

  it('appends BTM-only items: login helpers, embedded agents, and enabled open-at-login apps', () => {
    const merged = mergeBtmRecords([], records, 501)
    const btmOnly = merged.filter((i) => i.managedBySystemSettings)
    const names = btmOnly.map((i) => i.name).sort()
    expect(names).toEqual(['ChatGPTHelper', 'Rectangle', 'RectangleLauncher'])
    const helper = btmOnly.find((i) => i.name === 'ChatGPTHelper')
    expect(helper).toMatchObject({ id: 'btm:22222222-2222-2222-2222-222222222222', type: 'launch_agent', enabled: false })
    const rectangle = btmOnly.find((i) => i.name === 'Rectangle')
    expect(rectangle).toMatchObject({ type: 'login_item', enabled: true })
  })

  it('skips disabled app records, extension types, developer groups, and other users', () => {
    const merged = mergeBtmRecords([], records, 777)
    // Only the negative-UID (system) section applies; vmnetd there is a legacy daemon → not btm-only.
    expect(merged).toHaveLength(0)
  })

  it('does not duplicate items already found by the plist scan', () => {
    const items = [plistItem({ id: 'a', path: '/Library/LaunchAgents/us.zoom.updater.plist' })]
    const merged = mergeBtmRecords(items, records, 501)
    expect(merged.filter((i) => i.path === '/Library/LaunchAgents/us.zoom.updater.plist')).toHaveLength(1)
  })
})
