import { describe, expect, it } from 'vitest'
import { peerLabel } from '../../src/renderer/src/features/process/peerLabel'

describe('peerLabel', () => {
  it('maps Google 1e100 PTRs to "Google"', () => {
    expect(peerLabel('1.2.3.4', 'kul09s14-in-f14.1e100.net')).toBe('Google')
  })

  it('maps AWS EC2 compute PTRs to "AWS EC2"', () => {
    expect(peerLabel('1.2.3.4', 'ec2-1-2-3-4.compute-1.amazonaws.com')).toBe('AWS EC2')
  })

  it('maps Akamai variants', () => {
    expect(peerLabel('1.2.3.4', 'a23-45-67-89.deploy.static.akamaitechnologies.com')).toBe('Akamai')
  })

  it('maps youtube/googlevideo to YouTube', () => {
    expect(peerLabel('1.2.3.4', 'rr1---sn-foo.googlevideo.com')).toBe('YouTube')
  })

  it('falls back to raw hostname when no rule matches', () => {
    expect(peerLabel('1.2.3.4', 'mail.example.org')).toBe('mail.example.org')
  })

  it('falls back to IP when hostname is null', () => {
    expect(peerLabel('1.2.3.4', null)).toBe('1.2.3.4')
  })

  it('returns "*" when both hostname and ip are empty', () => {
    expect(peerLabel('', null)).toBe('*')
  })

  it('is case-insensitive', () => {
    expect(peerLabel('1.2.3.4', 'KUL09S14-IN-F14.1E100.NET')).toBe('Google')
  })
})
