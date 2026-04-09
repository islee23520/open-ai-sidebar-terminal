import { WebviewMessage } from "../../types";

declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

export interface VsCodeApi {
  postMessage: (message: WebviewMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
}

let vscodeApi: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function resetVsCodeApi(): void {
  vscodeApi = null;
}

export function postMessage(message: WebviewMessage): void {
  getVsCodeApi().postMessage(message);
}
