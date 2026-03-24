import { describe, expect, it } from 'vitest'
import { getCpuLevel, getCpuMeterText, renderTraySvg } from '../../src/main/app/trayIconFactory'

describe('trayIconFactory', () => {
  it('should quantize CPU usage into visual levels', () => {
    expect(getCpuLevel(0)).toBe(0)
    expect(getCpuLevel(24.9)).toBe(0)
    expect(getCpuLevel(25)).toBe(1)
    expect(getCpuLevel(50)).toBe(2)
    expect(getCpuLevel(75)).toBe(3)
    expect(getCpuLevel(90)).toBe(4)
  })

  it('should render monochrome macOS tray svg with pulse indicator', () => {
    const svg = renderTraySvg({ level: 4, pulse: true, platform: 'darwin', darkTaskbar: true })
    expect(svg).toContain('circle cx="19.4" cy="4.8" r="1.6"')
    expect(svg).toContain('fill="#000000"')
  })

  it('should render colored Windows tray svg for dark taskbar', () => {
    const svg = renderTraySvg({ level: 3, pulse: false, platform: 'win32', darkTaskbar: true })
    expect(svg).toContain('#38bdf8')
    expect(svg).toContain('#dbeafe')
  })

  it('should render dark Windows tray svg for light taskbar', () => {
    const svg = renderTraySvg({ level: 3, pulse: false, platform: 'win32', darkTaskbar: false })
    expect(svg).toContain('#0284c7')
    expect(svg).toContain('#1e293b')
  })

  it('should return compact meter text for macOS tray title', () => {
    expect(getCpuMeterText(10, false)).toBe('[□□□□]')
    expect(getCpuMeterText(40, false)).toBe('[■□□□]')
    expect(getCpuMeterText(60, false)).toBe('[■■□□]')
    expect(getCpuMeterText(80, true)).toBe('[▣▣▣□]')
    expect(getCpuMeterText(95, true)).toBe('[▣▣▣▣]')
  })
})
