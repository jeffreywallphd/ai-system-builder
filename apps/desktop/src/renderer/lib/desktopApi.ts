import type { DesktopImageUploadResponse } from "../../../../../modules/contracts/ipc";

export interface DesktopImageUploadApi {
  uploadImage: (input: {
    fileName: string;
    mediaType: string;
    bytes: Uint8Array;
  }) => Promise<DesktopImageUploadResponse>;
}

export interface DesktopApi {
  uploadImage: DesktopImageUploadApi["uploadImage"];
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export function getDesktopApi(): DesktopApi {
  if (!window.desktopApi) {
    throw new Error("Desktop preload API is unavailable.");
  }

  return window.desktopApi;
}
