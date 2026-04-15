export interface DesktopImageUploadInput {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface DesktopUploadedImageDescriptor {
  key: string;
  mediaType: string;
  sizeBytes: number;
}

export type DesktopImageUploadResult =
  | {
      ok: true;
      value: {
        descriptor: DesktopUploadedImageDescriptor;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

interface DesktopImageUploadPreloadResponse extends DesktopImageUploadResult {
  operation: string;
  channel: string;
}

interface DesktopPreloadApi {
  uploadImage: (input: DesktopImageUploadInput) => Promise<DesktopImageUploadPreloadResponse>;
}

export interface DesktopImageUploadApi {
  uploadImage: (input: DesktopImageUploadInput) => Promise<DesktopImageUploadResult>;
}

declare global {
  interface Window {
    desktopApi?: DesktopPreloadApi;
  }
}

export function getDesktopPreloadApi(): DesktopPreloadApi {
  if (!window.desktopApi) {
    throw new Error("Desktop preload API is unavailable.");
  }

  return window.desktopApi;
}
