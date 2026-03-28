export const StudioHandoffSdkErrorCodes = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  invalidRequest: "invalid-request",
  notFound: "not-found",
  conflict: "conflict",
  internal: "internal",
} as const);

export type StudioHandoffSdkErrorCode = typeof StudioHandoffSdkErrorCodes[keyof typeof StudioHandoffSdkErrorCodes];

export interface StudioHandoffSdkValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface StudioHandoffSdkError {
  readonly code: StudioHandoffSdkErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<StudioHandoffSdkValidationError>;
}

export interface StudioHandoffSdkResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: StudioHandoffSdkError;
}

export interface StudioHandoffSdkAuthentication {
  readonly bearerToken?: string;
}

export interface StudioHandoffSdkAccessContext {
  readonly callerKind: "user" | "service" | "tool";
  readonly callerId: string;
  readonly tenantId?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly source?: "external-api" | "deployment-api" | "internal-trusted";
}

export interface StudioHandoffSdkAssetReference {
  readonly assetId: string;
  readonly versionId: string;
  readonly role?: string;
}

export interface StudioHandoffSdkRouteCandidate {
  readonly studioType: string;
  readonly studioId: string;
  readonly registrationKind?: "atomic" | "composite" | "system";
  readonly compatible: boolean;
  readonly score: number;
  readonly matchedContractId?: string;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface StudioHandoffSdkRouteDecision {
  readonly preferredTarget?: {
    readonly studioType: string;
    readonly studioId: string;
    readonly matchedContractId?: string;
  };
  readonly candidates: ReadonlyArray<StudioHandoffSdkRouteCandidate>;
  readonly deterministicSignature: string;
}

export interface StudioHandoffSdkInitiateRequest {
  readonly handoffId?: string;
  readonly source: {
    readonly studioId: string;
    readonly studioType: string;
    readonly sessionId?: string;
  };
  readonly target?: {
    readonly studioId: string;
    readonly studioType: string;
    readonly sessionId?: string;
  };
  readonly sourceOutput: {
    readonly authoritativeAsset: {
      readonly assetId: string;
      readonly versionId: string;
      readonly taxonomy: {
        readonly structuralKind: string;
        readonly semanticRole: string;
        readonly behaviorKind: string;
      };
    };
    readonly sourceReferences?: ReadonlyArray<StudioHandoffSdkAssetReference>;
    readonly handoffHints?: Readonly<Record<string, unknown>>;
  };
  readonly multiAsset?: {
    readonly grouped: boolean;
    readonly requireAllAssets?: boolean;
    readonly assets: ReadonlyArray<{
      readonly role: string;
      readonly assetId: string;
      readonly versionId: string;
      readonly taxonomy: {
        readonly structuralKind: string;
        readonly semanticRole: string;
        readonly behaviorKind: string;
      };
    }>;
  };
  readonly intent: {
    readonly kind: string;
    readonly note?: string;
  };
  readonly context?: {
    readonly correlationId?: string;
    readonly sourceReferences?: ReadonlyArray<StudioHandoffSdkAssetReference>;
    readonly prefill?: Readonly<Record<string, unknown>>;
  };
}

export interface StudioHandoffSdkRetryRequest {
  readonly handoffId: string;
  readonly targetHandoffId?: string;
  readonly sourceOutput: StudioHandoffSdkInitiateRequest["sourceOutput"];
  readonly contextOverride?: StudioHandoffSdkInitiateRequest["context"];
  readonly reconcileChanges?: {
    readonly assetVersionUpdates?: ReadonlyArray<StudioHandoffSdkAssetReference>;
    readonly contextPatch?: Readonly<Record<string, unknown>>;
  };
}

export interface StudioHandoffSdkRetryLink {
  readonly attemptKind: "retry" | "reconciliation";
  readonly decision: "retryable" | "reconcilable" | "terminal";
  readonly reasonCode: string;
  readonly reason: string;
  readonly sourceHandoffId: string;
  readonly targetHandoffId: string;
  readonly initiatedAt: string;
}

export interface StudioHandoffSdkRecordSummary {
  readonly handoffId: string;
  readonly status: "prepared" | "failed";
  readonly sourceStudio: {
    readonly studioId: string;
    readonly studioType: string;
  };
  readonly targetStudio: {
    readonly studioId: string;
    readonly studioType: string;
  };
  readonly authoritativeAsset: {
    readonly assetId: string;
    readonly versionId: string;
  };
  readonly bundledAssets: ReadonlyArray<StudioHandoffSdkAssetReference>;
  readonly revision?: {
    readonly revisionId: string;
    readonly previousHandoffId: string;
    readonly updatedHandoffId: string;
  };
  readonly retryLink?: StudioHandoffSdkRetryLink;
  readonly routeDecision?: StudioHandoffSdkRouteDecision;
  readonly issueCodes: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StudioHandoffSdkInitiateResponse {
  readonly handoff: StudioHandoffSdkRecordSummary;
  readonly result: {
    readonly accepted: boolean;
    readonly compatibility: {
      readonly compatible: boolean;
      readonly matchedContractId?: string;
      readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
    };
  };
}

export interface StudioHandoffSdkStatusRequest {
  readonly handoffId: string;
}

export interface StudioHandoffSdkStatusResponse {
  readonly handoff?: StudioHandoffSdkRecordSummary;
}

export interface StudioHandoffSdkRetryResponse {
  readonly handoff: StudioHandoffSdkRecordSummary;
  readonly retryDecision: {
    readonly decision: "retryable" | "reconcilable" | "terminal";
    readonly reasonCode: string;
    readonly reason: string;
  };
}
