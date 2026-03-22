export const STATE_STYLES: Record<string, { bg: string; color: string; tip: string }> = {
  LISTEN:       { bg: 'var(--success-soft)', color: 'var(--accent-green)', tip: '포트에서 연결 대기 중' },
  ESTABLISHED:  { bg: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', tip: '연결이 수립된 상태' },
  SYN_SENT:     { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', tip: '연결 요청을 보낸 상태' },
  SYN_RECEIVED: { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', tip: '연결 요청을 받은 상태' },
  SYN_RECV:     { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', tip: '연결 요청을 받은 상태' },
  FIN_WAIT_1:   { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '연결 종료를 시작함' },
  FIN_WAIT_2:   { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '상대의 FIN을 기다리는 중' },
  FIN_WAIT1:    { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '연결 종료를 시작함' },
  FIN_WAIT2:    { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '상대의 FIN을 기다리는 중' },
  TIME_WAIT:    { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '종료 후 잔여 패킷 대기' },
  CLOSING:      { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '양쪽이 동시에 종료를 시작' },
  LAST_ACK:     { bg: 'var(--alert-yellow-soft)', color: 'var(--accent-yellow)', tip: '마지막 ACK를 기다리는 중' },
  CLOSE_WAIT:   { bg: 'var(--alert-red-soft)', color: 'var(--accent-red)', tip: '상대가 연결을 종료함 — close() 필요' },
  CLOSED:       { bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', tip: '연결 종료됨' },
  UNKNOWN:      { bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', tip: 'UDP 또는 상태 불명' },
}

const DEFAULT_STATE_STYLE = { bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)' }

export function getStateStyle(state: string): { bg: string; color: string; tip: string } {
  return STATE_STYLES[state] ?? { ...DEFAULT_STATE_STYLE, tip: state }
}
