import { ipcRenderer } from "electron";

export type Callback = (data: unknown) => void;

export function createListener(channel: string) {
  return (callback: Callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void =>
      callback(data);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  };
}

function createRequestMeta() {
  return {
    __requestMeta: {
      requestId: crypto.randomUUID(),
    },
  };
}

/**
 * IPC 호출 시 requestMeta를 마지막 인자로 자동 추가한다.
 * 핸들러 측에서는 마지막 파라미터를 `metaArg?: IpcRequestMetaArg`로 선언하여 수신한다.
 * 주의: 핸들러 파라미터를 추가/제거할 때 metaArg 위치가 밀리지 않도록 항상 마지막에 둘 것.
 */
export function invokeWithRequestId(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args, createRequestMeta());
}

export function successResult<T>(data: T) {
  return Promise.resolve({ ok: true as const, data });
}
