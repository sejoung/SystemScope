export type AppErrorCode =
  | 'SCAN_FAILED'
  | 'PERMISSION_DENIED'
  | 'THRESHOLD_INVALID'
  | 'INVALID_INPUT'
  | 'JOB_NOT_FOUND'
  | 'UNKNOWN_ERROR'

export interface AppError {
  code: AppErrorCode
  message: string
  details?: unknown
}

export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export function success<T>(data: T): AppResult<T> {
  return { ok: true, data }
}

export function failure(code: AppErrorCode, message: string, details?: unknown): AppResult<never> {
  return { ok: false, error: { code, message, details } }
}
