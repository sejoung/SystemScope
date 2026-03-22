export type ShutdownPhase =
  | 'starting'
  | 'cancelling_jobs'
  | 'waiting_snapshot'
  | 'cleaning_up'
  | 'finishing'

export interface ShutdownState {
  phase: ShutdownPhase
  message: string
}
