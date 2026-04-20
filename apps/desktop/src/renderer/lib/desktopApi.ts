import type {
  ArtifactBrowseItem as ArtifactBrowseContractItem,
  ArtifactDetailReadModel as ArtifactDetailContractModel,
} from "../../../../../modules/contracts/artifact-browser";

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
  artifactFamily: ArtifactBrowseContractItem["artifactFamily"];
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

export interface DesktopWebsiteCaptureMetadata {
  sourceUrl: string;
  resolvedUrl: string;
  requestedMode: "automatic" | "rendered";
  acquisitionMechanismUsed: "simple-http" | "rendered-browser";
  retrievedAt: string;
  httpStatus?: number;
  contentTypeHeader?: string;
}

export interface DesktopArtifactDetail {
  locator: DesktopArtifactBrowserLocator;
  artifactFamily: ArtifactDetailContractModel["artifactFamily"];
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: string;
  originalName?: string;
  createdAt?: string;
  metadata?: {
    publishedBacking?: DesktopPublishedBacking;
    importedSourceBacking?: DesktopPublishedBacking;
    websiteCapture?: DesktopWebsiteCaptureMetadata;
  };
}

export type DesktopArtifactFamily = ArtifactBrowseContractItem["artifactFamily"];

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

export interface DesktopWebsiteIngestionTarget {
  url: string;
  label?: string;
}

export interface DesktopWebsiteIngestionStagedArtifact {
  sourceKind: string;
  originalName?: string;
  storage: {
    key: string;
    mediaType?: string;
    sizeBytes?: number;
  };
  metadata?: {
    requestedMode?: "automatic" | "rendered";
    acquisitionMechanismUsed?: "simple-http" | "rendered-browser";
  };
}

export interface DesktopWebsitePageIngestionResult {
  target: DesktopWebsiteIngestionTarget;
  resolvedUrl: string;
  acquisitionMechanismUsed: "simple-http" | "rendered-browser";
  stagedArtifact?: DesktopWebsiteIngestionStagedArtifact;
  warnings?: string[];
}

export interface DesktopWebsitePagesBatchSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

export interface DesktopWebsitePagesBatchItem {
  target: DesktopWebsiteIngestionTarget;
  ok: boolean;
  result?: DesktopWebsitePageIngestionResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface DesktopPrepareTemplatedDatasetInput {
  sourceArtifactIds: string[];
  template: string;
  split: {
    trainRatio: number;
    testRatio: number;
    seed?: number;
  };
  outputFormat: "jsonl" | "json" | "csv";
  shuffle?: boolean;
}

export interface DesktopPreparedTemplatedDatasetResult {
  train: {
    storage: { key: string; mediaType?: string; sizeBytes?: number };
    sourceKind: string;
    originalName?: string;
  };
  test: {
    storage: { key: string; mediaType?: string; sizeBytes?: number };
    sourceKind: string;
    originalName?: string;
  };
  trainRowCount: number;
  testRowCount: number;
  warnings?: string[];
}

export interface DesktopArtifactUploadApi {
  uploadArtifact: (input: DesktopArtifactUploadInput) => Promise<DesktopArtifactUploadResult>;
  getArtifactUploadPolicy: () => Promise<DesktopArtifactUploadAcceptedTypePolicy>;
  ingestWebsitePage: (input: {
    url: string;
    label?: string;
    mode?: "automatic" | "rendered";
  }) => Promise<unknown>;
  ingestWebsitePagesBatch: (input: {
    targets: DesktopWebsiteIngestionTarget[];
    mode?: "automatic" | "rendered";
  }) => Promise<unknown>;
}

export interface DesktopDatasetPreparationApi {
  prepareTemplatedDatasetFromArtifacts: (
    input: DesktopPrepareTemplatedDatasetInput,
  ) => Promise<unknown>;
}

interface DesktopApiBridge {
  getHuggingFaceTokenStatus: () => Promise<unknown>;
  setHuggingFaceToken: (input: { token: string }) => Promise<unknown>;
  clearHuggingFaceToken: () => Promise<unknown>;
  browseHuggingFaceNamespaceDatasets: (input: { namespace: string }) => Promise<unknown>;
  browseHuggingFaceDatasetParquetFiles: (input: { repository: string; revision?: string }) => Promise<unknown>;
  uploadArtifact: (input: DesktopArtifactUploadInput) => Promise<unknown>;
  getArtifactUploadPolicy: () => Promise<unknown>;
  ingestWebsitePage?: (input: {
    url: string;
    label?: string;
    mode?: "automatic" | "rendered";
  }) => Promise<unknown>;
  ingestWebsitePagesBatch?: (input: {
    targets: DesktopWebsiteIngestionTarget[];
    mode?: "automatic" | "rendered";
  }) => Promise<unknown>;
  prepareTemplatedDatasetFromArtifacts?: (input: DesktopPrepareTemplatedDatasetInput) => Promise<unknown>;
  browseArtifacts: (input?: { artifactFamily?: DesktopArtifactFamily }) => Promise<unknown>;
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
    artifactFamily?: DesktopArtifactFamily;
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
