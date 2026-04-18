export interface DesktopImageUploadInput {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface DesktopArtifactBrowserLocator {
  storageKey: string;
}

export interface DesktopUploadedImageDescriptor {
  key: string;
  mediaType: string;
  sizeBytes: number;
}

export interface DesktopArtifactBrowseItem {
  storageKey: string;
  artifactKind: "image";
  mediaType?: string;
  sizeBytes?: number;
  originalName?: string;
  createdAt?: string;
}

export interface DesktopArtifactDetail {
  locator: DesktopArtifactBrowserLocator;
  artifactKind: "image";
  mediaType?: string;
  sizeBytes?: number;
  originalName?: string;
  createdAt?: string;
  metadata?: {
    publishedBacking?: DesktopPublishedBacking;
  };
}

export interface DesktopArtifactContentDescriptor {
  locator: DesktopArtifactBrowserLocator;
  mediaType?: string;
  sizeBytes?: number;
  availability: "available" | "unavailable";
  retrieval: "inline" | "deferred";
}

export interface DesktopArtifactMediaView {
  storageKey: string;
  mediaType?: string;
  sizeBytes?: number;
  bytes: Uint8Array;
}

export interface DesktopPublishedBacking {
  target: {
    provider: string;
    repository: string;
    path: string;
    revision?: string;
    locator?: string;
  };
  verification: {
    exists: boolean;
    verifiedAt?: string;
  };
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

export interface DesktopImageUploadApi {
  uploadImage: (input: DesktopImageUploadInput) => Promise<DesktopImageUploadResult>;
}

interface DesktopApiBridge {
  uploadImage: (input: DesktopImageUploadInput) => Promise<unknown>;
  browseArtifacts: () => Promise<unknown>;
  readArtifactDetail: (locator: DesktopArtifactBrowserLocator) => Promise<unknown>;
  readArtifactContentDescriptor: (locator: DesktopArtifactBrowserLocator) => Promise<unknown>;
  readArtifactViewerMedia: (locator: DesktopArtifactBrowserLocator) => Promise<unknown>;
  publishArtifactToRepo: (input: {
    artifactId: string;
    target: {
      provider: string;
      repository: string;
      path: string;
      revision?: string;
    };
    mediaType?: string;
  }) => Promise<unknown>;
  verifyPublishedArtifactBacking: (input: {
    artifactId: string;
  }) => Promise<unknown>;
}

declare global {
  interface Window {
    desktopApi?: DesktopApiBridge;
  }
}

export function getDesktopApi(): DesktopApiBridge {
  if (!window.desktopApi) {
    throw new Error("Desktop preload API is unavailable.");
  }

  return window.desktopApi;
}
