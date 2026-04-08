import type { ImageAssetManagementApiResponse } from "./sdk/PublicImageAssetManagementApiContract";
import { sanitizeImageAssetManagementObservabilityPayload } from "./ImageAssetManagementObservabilityRedaction";
import {
  createImageManipulationSliceCorrelation,
  deriveImageManipulationResilienceDiagnostics,
  IMAGE_MANIPULATION_SLICE_NAME,
  type ImageManipulationSliceCorrelation,
  type ImageManipulationSliceResilienceDiagnostic,
} from "@infrastructure/logging/ImageManipulationSliceDiagnostics";

export const ImageAssetManagementObservabilityFlows = Object.freeze({
  create: "create",
  uploadIngest: "upload-ingest",
  uploadFinalize: "upload-finalize",
  metadataGet: "metadata-get",
  metadataList: "metadata-list",
  originalOpen: "original-open",
  previewRequest: "preview-request",
  previewOpen: "preview-open",
} as const);

export type ImageAssetManagementObservabilityFlow =
  typeof ImageAssetManagementObservabilityFlows[keyof typeof ImageAssetManagementObservabilityFlows];

export interface ImageAssetManagementObservabilityLogEvent {
  readonly slice: typeof IMAGE_MANIPULATION_SLICE_NAME;
  readonly event: string;
  readonly flow: ImageAssetManagementObservabilityFlow;
  readonly outcome: "success" | "rejected" | "failure";
  readonly severity: "info" | "warn" | "error";
  readonly occurredAt: string;
  readonly requestId: string;
  readonly trace: Readonly<{
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly assetId?: string;
    readonly correlationId?: string;
    readonly operationKey?: string;
  }>;
  readonly diagnostics: Readonly<Record<string, unknown>>;
  readonly correlation: Readonly<ImageManipulationSliceCorrelation>;
  readonly resilience?: ReadonlyArray<ImageManipulationSliceResilienceDiagnostic>;
}

export interface ImageAssetManagementObservabilityLogger {
  info(event: ImageAssetManagementObservabilityLogEvent): void;
  warn(event: ImageAssetManagementObservabilityLogEvent): void;
  error(event: ImageAssetManagementObservabilityLogEvent): void;
}

export interface ImageAssetManagementObservabilityRecordInput {
  readonly flow: ImageAssetManagementObservabilityFlow;
  readonly request: unknown;
  readonly response: ImageAssetManagementApiResponse<unknown>;
  readonly occurredAt?: string;
  readonly trace?: Readonly<{
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly assetId?: string;
    readonly correlationId?: string;
    readonly operationKey?: string;
  }>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface ImageAssetManagementObservabilityOptions {
  readonly logger?: ImageAssetManagementObservabilityLogger;
}

export class ImageAssetManagementObservability {
  private readonly logger: ImageAssetManagementObservabilityLogger;

  public constructor(options: ImageAssetManagementObservabilityOptions = {}) {
    this.logger = options.logger ?? new ConsoleImageAssetManagementObservabilityLogger();
  }

  public async recordApiOutcome(input: ImageAssetManagementObservabilityRecordInput): Promise<void> {
    try {
      const outcome = resolveOutcome(input.response);
      const occurredAt = normalizeOptional(input.occurredAt) ?? new Date().toISOString();
      const trace = Object.freeze({
        actorUserIdentityId: normalizeOptional(input.trace?.actorUserIdentityId),
        workspaceId: normalizeOptional(input.trace?.workspaceId),
        assetId: normalizeOptional(input.trace?.assetId),
        correlationId: normalizeOptional(input.trace?.correlationId),
        operationKey: normalizeOptional(input.trace?.operationKey),
      });
      const requestId = trace.correlationId
        ?? trace.operationKey
        ?? trace.assetId
        ?? trace.workspaceId
        ?? normalizeOptional(trace.actorUserIdentityId)
        ?? "image-asset-api";
      const correlation = createImageManipulationSliceCorrelation({
        requestId,
        correlationId: trace.correlationId,
        workspaceId: trace.workspaceId,
        assetId: trace.assetId,
        operationKey: trace.operationKey,
      });
      const resilience = !input.response.ok
        ? deriveImageManipulationResilienceDiagnostics({
          details: input.response.error?.details,
          defaultCode: `image-asset-${input.flow}-${input.response.error?.code ?? "failed"}`,
          defaultSummary: input.response.error?.message?.trim() || "Image asset API operation failed.",
          defaultCategory: input.response.error?.code === "invalid-request" ? "validation" : "operational",
          defaultRetryable: false,
          defaultDegraded: input.response.error?.code === "internal",
        })
        : undefined;

      const event = sanitizeImageAssetManagementObservabilityPayload(Object.freeze({
        slice: IMAGE_MANIPULATION_SLICE_NAME,
        event: `image-asset-management.${input.flow}.completed`,
        flow: input.flow,
        outcome: outcome.outcome,
        severity: outcome.severity,
        occurredAt,
        requestId,
        trace,
        correlation,
        resilience,
        diagnostics: Object.freeze({
          request: input.request,
          response: input.response,
          details: input.diagnostics,
        }),
      })) as ImageAssetManagementObservabilityLogEvent;

      if (event.severity === "error") {
        this.logger.error(event);
      } else if (event.severity === "warn") {
        this.logger.warn(event);
      } else {
        this.logger.info(event);
      }
    } catch {
      // Observability is best-effort and must never block image ingestion flows.
    }
  }
}

function resolveOutcome(response: ImageAssetManagementApiResponse<unknown>): {
  readonly outcome: "success" | "rejected" | "failure";
  readonly severity: "info" | "warn" | "error";
} {
  if (response.ok) {
    return Object.freeze({
      outcome: "success" as const,
      severity: "info" as const,
    });
  }

  if (response.error?.code === "internal") {
    return Object.freeze({
      outcome: "failure" as const,
      severity: "error" as const,
    });
  }

  return Object.freeze({
    outcome: "rejected" as const,
    severity: "warn" as const,
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

class ConsoleImageAssetManagementObservabilityLogger implements ImageAssetManagementObservabilityLogger {
  public info(event: ImageAssetManagementObservabilityLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: ImageAssetManagementObservabilityLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: ImageAssetManagementObservabilityLogEvent): void {
    console.error(JSON.stringify(event));
  }
}
