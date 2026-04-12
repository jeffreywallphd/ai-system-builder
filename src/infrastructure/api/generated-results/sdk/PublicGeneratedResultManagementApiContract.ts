export const GeneratedResultManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  invalidState: "invalid-state",
  internal: "internal",
} as const);

export type GeneratedResultManagementApiErrorCode =
  typeof GeneratedResultManagementApiErrorCodes[keyof typeof GeneratedResultManagementApiErrorCodes];

export interface GeneratedResultManagementApiError {
  readonly code: GeneratedResultManagementApiErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface GeneratedResultManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: GeneratedResultManagementApiError;
}

export interface ListGeneratedResultsApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly runId?: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly statuses?: ReadonlyArray<"pending-collection" | "available" | "preview-ready" | "failed-collection" | "archived">;
  readonly visibilities?: ReadonlyArray<"private" | "workspace" | "public">;
  readonly mediaTypes?: ReadonlyArray<"image/png" | "image/jpeg" | "image/webp">;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly previewStates?: ReadonlyArray<"preview-pending" | "preview-available" | "preview-failed" | "preview-unavailable">;
  readonly hasPreview?: boolean;
  readonly lineageInputAssetIds?: ReadonlyArray<string>;
  readonly requiredInputPurposes?: ReadonlyArray<string>;
  readonly requiredAssetClasses?: ReadonlyArray<string>;
  readonly requiredMediaClasses?: ReadonlyArray<string>;
  readonly reuseReadyOnly?: boolean;
  readonly includeArchived?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ListGeneratedResultsApiResponse {
  readonly items: ReadonlyArray<{
    readonly resultAssetId: string;
    readonly workspaceId: string;
    readonly ownerUserId?: string;
    readonly runId: string;
    readonly systemId: string;
    readonly workflowId: string;
    readonly workflowTemplateId?: string;
    readonly executionNodeId?: string;
    readonly outputSlot: string;
    readonly status: "pending-collection" | "available" | "preview-ready" | "failed-collection" | "archived";
    readonly mediaType?: "image/png" | "image/jpeg" | "image/webp";
    readonly visibility: "private" | "workspace" | "public";
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly preview: {
      readonly state: "preview-pending" | "preview-available" | "preview-failed" | "preview-unavailable";
      readonly hasPreview: boolean;
      readonly primaryPreviewKind?: "thumbnail" | "display-safe" | "history-safe";
      readonly availabilityStatus?: "pending" | "available" | "failed" | "stale";
    };
    readonly retrieval: {
      readonly state: "retrieval-available" | "retrieval-temporarily-unavailable" | "retrieval-unavailable" | "result-unavailable";
      readonly reasonCode?: string;
      readonly retryable?: boolean;
    };
    readonly lineage: {
      readonly resultAssetId: string;
      readonly runId: string;
      readonly systemId: string;
      readonly workflowId: string;
      readonly workflowTemplateId?: string;
      readonly executionNodeId?: string;
      readonly outputSlot: string;
      readonly inputAssetCount: number;
      readonly hasWorkflowTemplateVersion: boolean;
      readonly hasSystemSnapshot: boolean;
      readonly hasParameterSnapshot: boolean;
      readonly hasSelectedNode: boolean;
    };
    readonly reuse: {
      readonly reusableAsWorkflowInput: boolean;
      readonly logicalAssetReference: string;
      readonly supportedInputPurposes: ReadonlyArray<string>;
      readonly assetClasses: ReadonlyArray<string>;
      readonly mediaClasses: ReadonlyArray<string>;
      readonly sourceContext: {
        readonly runId: string;
        readonly workflowId: string;
        readonly systemId: string;
        readonly executionNodeId?: string;
        readonly outputSlot: string;
        readonly inputAssetCount: number;
      };
    };
  }>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface GetGeneratedResultApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetGeneratedResultApiResponse {
  readonly result: {
    readonly resultAssetId: string;
    readonly workspaceId: string;
    readonly ownerUserId?: string;
    readonly runId: string;
    readonly systemId: string;
    readonly workflowId: string;
    readonly workflowTemplateId?: string;
    readonly executionNodeId?: string;
    readonly outputSlot: string;
    readonly status: "pending-collection" | "available" | "preview-ready" | "failed-collection" | "archived";
    readonly mediaType?: "image/png" | "image/jpeg" | "image/webp";
    readonly visibility: "private" | "workspace" | "public";
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly preview: ListGeneratedResultsApiResponse["items"][number]["preview"];
    readonly retrieval: ListGeneratedResultsApiResponse["items"][number]["retrieval"];
    readonly lineage: ListGeneratedResultsApiResponse["items"][number]["lineage"];
    readonly reuse: ListGeneratedResultsApiResponse["items"][number]["reuse"];
    readonly sharingPolicyRef?: {
      readonly policyId: string;
      readonly policyVersion?: string;
    };
    readonly storage: {
      readonly storageInstanceId: string;
      readonly storageBindingReference?: string;
    };
    readonly lifecycle: {
      readonly pendingSince: string;
      readonly logicalAssetVersionId?: string;
      readonly persistedAt?: string;
      readonly persistedBy?: string;
      readonly previewReadyAt?: string;
      readonly previewReadyBy?: string;
      readonly failedAt?: string;
      readonly failedBy?: string;
      readonly failureCode?: string;
      readonly failureMessage?: string;
      readonly archivedAt?: string;
      readonly archivedBy?: string;
    };
    readonly previewDescriptors: ReadonlyArray<{
      readonly derivativeId: string;
      readonly previewKind: "thumbnail" | "display-safe" | "history-safe";
      readonly availabilityStatus: "pending" | "available" | "failed" | "stale";
      readonly isPrimaryPreview: boolean;
      readonly mediaType?: "image/png" | "image/jpeg" | "image/webp";
      readonly width?: number;
      readonly height?: number;
      readonly byteSize?: number;
      readonly protectedResourceId?: string;
      readonly accessHandle?: string;
      readonly generatedAt?: string;
      readonly failureCode?: string;
      readonly failureMessage?: string;
    }>;
    readonly lineageDetail: {
      readonly inputAssetIds: ReadonlyArray<string>;
      readonly workflowTemplateVersionId?: string;
      readonly workflowTemplateVersionTag?: string;
      readonly systemSnapshotId?: string;
      readonly systemVersionTag?: string;
      readonly parameterSnapshotId?: string;
      readonly selectedNodeId?: string;
      readonly executionAdapterKind?: string;
      readonly executionBackendFamily?: string;
      readonly updatedAt: string;
    };
  };
}

export interface ListGeneratedResultsByRunApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ListGeneratedResultsByRunApiResponse {
  readonly runId: string;
  readonly items: ListGeneratedResultsApiResponse["items"];
  readonly pagination: ListGeneratedResultsApiResponse["pagination"];
}

export interface OpenGeneratedResultOriginalContentStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenGeneratedResultOriginalContentStreamApiResponse {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface RequestGeneratedResultPreviewApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly preferredPreviewKinds?: ReadonlyArray<"thumbnail" | "display-safe" | "history-safe">;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface RequestGeneratedResultPreviewApiResponse {
  readonly preview: {
    readonly resultAssetId: string;
    readonly workspaceId: string;
    readonly state: "preview-pending" | "preview-available" | "preview-failed" | "preview-unavailable";
    readonly available: boolean;
    readonly reasonCode?: string;
    readonly retryable?: boolean;
    readonly selected?: {
      readonly derivativeId: string;
      readonly previewKind: "thumbnail" | "display-safe" | "history-safe";
      readonly mediaType: string;
      readonly width?: number;
      readonly height?: number;
      readonly byteSize?: number;
      readonly previewToken: string;
      readonly contentEndpoint: string;
    };
    readonly alternatives: ReadonlyArray<{
      readonly derivativeId: string;
      readonly previewKind: "thumbnail" | "display-safe" | "history-safe";
      readonly availabilityStatus: "pending" | "available" | "failed" | "stale";
      readonly mediaType?: string;
      readonly width?: number;
      readonly height?: number;
      readonly byteSize?: number;
      readonly failureCode?: string;
    }>;
  };
}

export interface OpenGeneratedResultPreviewContentStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly previewToken: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenGeneratedResultPreviewContentStreamApiResponse {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDisposition: "inline";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface GetGeneratedResultLineageSummaryApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetGeneratedResultLineageSummaryApiResponse {
  readonly lineage: {
    readonly resultAssetId: string;
    readonly runId: string;
    readonly systemId: string;
    readonly workflowId: string;
    readonly workflowTemplateId?: string;
    readonly executionNodeId?: string;
    readonly outputSlot: string;
    readonly inputAssetCount: number;
    readonly hasWorkflowTemplateVersion: boolean;
    readonly hasSystemSnapshot: boolean;
    readonly hasParameterSnapshot: boolean;
    readonly hasSelectedNode: boolean;
  };
}

export interface GetGeneratedResultLineageDetailApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly resultAssetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetGeneratedResultLineageDetailApiResponse {
  readonly lineage: {
    readonly summary: {
      readonly resultAssetId: string;
      readonly runId: string;
      readonly systemId: string;
      readonly workflowId: string;
      readonly workflowTemplateId?: string;
      readonly executionNodeId?: string;
      readonly outputSlot: string;
      readonly inputAssetCount: number;
      readonly hasWorkflowTemplateVersion: boolean;
      readonly hasSystemSnapshot: boolean;
      readonly hasParameterSnapshot: boolean;
      readonly hasSelectedNode: boolean;
    };
    readonly source: {
      readonly workflowTemplateVersionId?: string;
      readonly workflowTemplateVersionTag?: string;
      readonly systemSnapshotId?: string;
      readonly systemVersionTag?: string;
      readonly parameterSnapshotId?: string;
      readonly selectedNodeId?: string;
      readonly executionAdapterKind?: string;
      readonly executionBackendFamily?: string;
    };
    readonly upstreamInputs: ReadonlyArray<{
      readonly assetId: string;
    }>;
    readonly graph: {
      readonly nodes: ReadonlyArray<{
        readonly nodeId: string;
        readonly nodeType: "result" | "run" | "workflow" | "system" | "execution-node" | "input-asset";
        readonly referenceId: string;
        readonly label?: string;
      }>;
      readonly edges: ReadonlyArray<{
        readonly edgeId: string;
        readonly fromNodeId: string;
        readonly toNodeId: string;
        readonly relation:
        | "produced-by-run"
        | "run-used-workflow"
        | "run-targeted-system"
        | "run-executed-on-node"
        | "result-derived-from-input";
      }>;
    };
  };
}
