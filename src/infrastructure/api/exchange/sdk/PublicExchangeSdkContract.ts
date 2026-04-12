export const ExchangeSdkErrorCodes = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  invalidRequest: "invalid-request",
  notFound: "not-found",
  conflict: "conflict",
  validationFailed: "validation-failed",
  internal: "internal",
} as const);

export type ExchangeSdkErrorCode = typeof ExchangeSdkErrorCodes[keyof typeof ExchangeSdkErrorCodes];

export interface ExchangeSdkValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ExchangeSdkError {
  readonly code: ExchangeSdkErrorCode;
  readonly message: string;
  readonly validationIssues?: ReadonlyArray<ExchangeSdkValidationIssue>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ExchangeSdkResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: ExchangeSdkError;
}

export interface ExchangeSdkAuthentication {
  readonly bearerToken?: string;
}

export interface ExchangeSdkAccessContext {
  readonly callerKind: "user" | "service" | "tool";
  readonly callerId: string;
  readonly sessionId?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly tenantId?: string;
  readonly source?: "exchange-api" | "external-api" | "internal-trusted";
  readonly metadata?: Readonly<Record<string, string>>;
}

export type ExchangeSdkSubjectKind = "atomic-asset" | "composite-asset" | "system-asset";

export interface ExchangeSdkPackageIdentity {
  readonly assetId: string;
  readonly versionId: string;
  readonly subjectKind: ExchangeSdkSubjectKind;
  readonly bundleId: string;
  readonly bundleFormatVersion: string;
  readonly packageId?: string;
  readonly catalogEntryId?: string;
}

export interface ExchangeSdkPackageMetadata {
  readonly title?: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly capabilityHints: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
  readonly provenance?: {
    readonly origin: string;
    readonly sourceBundleId?: string;
    readonly sourceVersionLineage: ReadonlyArray<string>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
}

export interface ExchangeSdkArtifactReference {
  readonly storageKind: "local-file" | "local-directory" | "opaque";
  readonly location: string;
  readonly mediaType?: string;
  readonly byteLength?: number;
  readonly sha256?: string;
}

export interface ExchangeSdkExportRequest {
  readonly subjectKind: ExchangeSdkSubjectKind;
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleFormatVersion?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface ExchangeSdkExportResult {
  readonly identity: ExchangeSdkPackageIdentity;
  readonly artifact: {
    readonly fileName: string;
    readonly mediaType: string;
    readonly byteLength: number;
    readonly sha256: string;
    readonly content: string;
  };
  readonly counts?: {
    readonly compositionCount?: number;
    readonly nodeCount?: number;
  };
}

export interface ExchangeSdkImportRequest {
  readonly subjectKind: ExchangeSdkSubjectKind;
  readonly artifactContent: string;
}

export interface ExchangeSdkImportResult {
  readonly identity: ExchangeSdkPackageIdentity;
  readonly importedAt: string;
  readonly existingAsset: boolean;
  readonly existingVersion: boolean;
  readonly dependencyCount?: number;
  readonly counts?: {
    readonly compositionCount?: number;
    readonly nodeCount?: number;
  };
  readonly conflict?: {
    readonly decision: "import-as-new-version" | "reuse-existing" | "remap-reference" | "reject-import";
    readonly reasonCode: string;
    readonly message: string;
  };
}

export interface ExchangeSdkPublishRequest {
  readonly catalogId: string;
  readonly packageId: string;
  readonly artifact: {
    readonly fileName: string;
    readonly mediaType: string;
    readonly content: string;
    readonly byteLength: number;
  };
  readonly metadata?: {
    readonly title?: string;
    readonly summary?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly capabilityHints?: ReadonlyArray<string>;
    readonly configurationHints?: Readonly<Record<string, unknown>>;
  };
}

export interface ExchangeSdkPublishResult {
  readonly identity: ExchangeSdkPackageIdentity & {
    readonly packageId: string;
    readonly catalogEntryId: string;
  };
  readonly status: "published";
  readonly catalog: {
    readonly catalogId: string;
    readonly registeredAt: string;
    readonly artifact: ExchangeSdkArtifactReference;
  };
  readonly metadata: ExchangeSdkPackageMetadata;
  readonly published: {
    readonly publishedAt: string;
    readonly publishedBy?: string;
    readonly accessPolicyId?: string;
  };
}

export interface ExchangeSdkCatalogListRequest {
  readonly catalogId: string;
  readonly packageKinds?: ReadonlyArray<ExchangeSdkSubjectKind>;
  readonly query?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface ExchangeSdkCatalogEntrySummary {
  readonly catalogId: string;
  readonly packageId: string;
  readonly identity: ExchangeSdkPackageIdentity & { readonly packageId: string; readonly catalogEntryId: string };
  readonly metadata: ExchangeSdkPackageMetadata;
  readonly artifact: ExchangeSdkArtifactReference;
  readonly registeredAt: string;
  readonly updatedAt: string;
}

export interface ExchangeSdkCatalogListResult {
  readonly entries: ReadonlyArray<ExchangeSdkCatalogEntrySummary>;
}
