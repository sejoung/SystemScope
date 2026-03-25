export interface IpcRequestMeta {
  requestId: string
}

export interface IpcRequestMetaArg {
  __requestMeta: IpcRequestMeta
}

export function getRequestMeta(value: unknown): IpcRequestMeta | null {
  if (!value || typeof value !== 'object' || !('__requestMeta' in value)) {
    return null
  }

  const meta = (value as IpcRequestMetaArg).__requestMeta
  if (!meta || typeof meta.requestId !== 'string' || !meta.requestId.trim()) {
    return null
  }

  return meta
}

export function withRequestMeta(
  requestMeta: IpcRequestMeta | null | undefined,
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!requestMeta) {
    return metadata
  }

  return metadata
    ? { ...metadata, requestId: requestMeta.requestId }
    : { requestId: requestMeta.requestId }
}
