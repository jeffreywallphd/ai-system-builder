export interface DesktopArtifactUploadInput {
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
  artifactFamily: string;
  mediaType?: string;
  sizeBytes?: number;
  originalName?: string;
  createdAt?: string;
  metadata?: {
    backingState?: {
      hasImportedSourceBacking: boolean;
      hasPublishedBacking: boolean;
      hasLocalObjectAvailable: boolean;
      isLocalized: boolean;
      isRemoteOnly: boolean;
    };
  };
}

export interface DesktopArtifactDetail {
  locator: DesktopArtifactBrowserLocator;
  artifactFamily: string;
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: string;
  originalName?: string;
  createdAt?: string;
  metadata?: {
    publishedBacking?: DesktopPublishedBacking;
    importedSourceBacking?: DesktopPublishedBacking;
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

export interface DesktopLocalizedArtifactFromRepo {
  artifactId: string;
  localObject: {
    key: string;
    mediaType?: string;
    sizeBytes: number;
  };
  source: {
    provider: string;
    repository: string;
    path: string;
    revision?: string;
    locator: string;
  };
  localizedAt: string;
}

export type DesktopArtifactUploadResult =
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

export interface DesktopArtifactUploadAcceptedTypePolicy {
  acceptedMediaTypes: readonly string[];
  acceptedExtensions: readonly string[];
}

export interface DesktopArtifactUploadApi {
  uploadArtifact: (input: DesktopArtifactUploadInput) => Promise<DesktopArtifactUploadResult>;
  getArtifactUploadPolicy: () => Promise<DesktopArtifactUploadAcceptedTypePolicy>;
}

interface DesktopApiBridge {
  getHuggingFaceTokenStatus: () => Promise<unknown>;
  setHuggingFaceToken: (input: { token: string }) => Promise<unknown>;
  clearHuggingFaceToken: () => Promise<unknown>;
  browseHuggingFaceNamespaceDatasets: (input: { namespace: string }) => Promise<unknown>;
  browseHuggingFaceDatasetParquetFiles: (input: { repository: string; revision?: string }) => Promise<unknown>;
  uploadArtifact: (input: DesktopArtifactUploadInput) => Promise<unknown>;
  getArtifactUploadPolicy: () => Promise<unknown>;
  browseArtifacts: (input?: { artifactFamily?: string }) => Promise<unknown>;
  browseUnregisteredArtifacts?: () => Promise<unknown>;
  registerUnregisteredArtifact?: (input: { storageKey: string }) => Promise<unknown>;
  deleteUnregisteredArtifact?: (input: { storageKey: string }) => Promise<unknown>;
  deleteRegisteredArtifact?: (input: { storageKey: string }) => Promise<unknown>;
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
  verifyImportedArtifactSourceBacking?: (input: {
    artifactId: string;
  }) => Promise<unknown>;
  registerArtifactFromRepo: (input: {
    target: {
      provider: string;
      repository: string;
      path: string;
      revision?: string;
    };
    artifactFamily?: string;
    mediaType?: string;
  }) => Promise<unknown>;
  localizeArtifactFromRepo: (input: {
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

export interface DesktopHuggingFaceTokenStatus {
  configured: boolean;
  maskedToken?: string;
}

export interface DesktopHuggingFaceNamespaceDataset {
  namespace: string;
  repository: string;
}

export interface DesktopHuggingFaceDatasetParquetFile {
  repository: string;
  path: string;
  revision: string;
  sizeBytes?: number;
}


export interface DesktopRegisteredArtifactFromRepo {
  artifactId: string;
  backing: {
    role: "imported-source";
    target: {
      provider: string;
      repository: string;
      path: string;
      revision: string;
      locator?: string;
    };
    verification: {
      exists: true;
      verifiedAt: string;
    };
  };
}

export interface DesktopUnregisteredArtifactBrowseItem {
  storageKey: string;
  relativePath: string;
  fileName: string;
  mediaType?: string;
  sizeBytes?: number;
}
