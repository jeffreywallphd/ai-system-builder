import {
  ImageManipulationCollectedExecutionStatuses,
  ImageManipulationOutputMediaKinds,
  ImageManipulationOutputRoles,
  ImageManipulationOutputSlotMatchStatuses,
  ImageManipulationOutputPersistenceStatuses,
  ImageManipulationTemporaryBackendReferenceKinds,
  createImageManipulationOutputCollectionFailure,
  validateImageManipulationCollectedExecutionResult,
  validateImageManipulationOutputDiscoverySnapshot,
  type ImageManipulationCollectedExecutionResult,
  type ImageManipulationCollectedOutputRecord,
  type ImageManipulationDiscoveredOutputDescriptor,
  type ImageManipulationOutputDiscoverySnapshot,
  type ImageManipulationOutputMediaMetadata,
  type ImageManipulationOutputSlotMatch,
} from "@application/image-workflows/ports";
import type { ComfyHistoryPromptEntryDto } from "@infrastructure/comfyui/dto/ComfyWorkflowDto";
import { ComfyUiTransportClient } from "./ComfyUiTransportClient";

export interface ComfyUiExpectedOutputBinding {
  readonly outputId: string;
  readonly backendField?: string;
  readonly logicalTargetReference?: string;
}

export interface ComfyUiOutputDiscoveryCollectionRequest {
  readonly executionJobId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly backendExecutionId: string;
  readonly expectedOutputs?: ReadonlyArray<ComfyUiExpectedOutputBinding>;
  readonly discoveredAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyUiOutputDiscoveryCollectionResult {
  readonly discovery: ImageManipulationOutputDiscoverySnapshot;
  readonly collected: ImageManipulationCollectedExecutionResult;
}

interface NormalizedImageArtifact {
  readonly nodeId: string;
  readonly outputIndex: number;
  readonly filename: string;
  readonly subfolder?: string;
  readonly type?: string;
}

export class ComfyUiOutputDiscoveryCollector {
  private readonly now: () => Date;

  public constructor(
    private readonly dependencies: {
      readonly transportClient: ComfyUiTransportClient;
      readonly now?: () => Date;
    },
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async discoverAndCollect(
    request: ComfyUiOutputDiscoveryCollectionRequest,
  ): Promise<ComfyUiOutputDiscoveryCollectionResult> {
    const discoveredAt = this.resolveTimestamp(request.discoveredAt);
    const historySnapshot = await this.dependencies.transportClient.queryPromptHistory({
      promptId: request.backendExecutionId,
    });
    const normalizedArtifacts = extractImageArtifacts(historySnapshot.historyEntry);
    const malformedArtifactCount = countMalformedImageArtifacts(historySnapshot.historyEntry);
    const discoveredOutputs = normalizedArtifacts.map((artifact, outputIndex) => this.toDiscoveredDescriptor({
      request,
      artifact,
      outputIndex,
      discoveredAt,
      expectedOutputs: request.expectedOutputs ?? [],
    }));

    const discovery = validateImageManipulationOutputDiscoverySnapshot({
      discoveryId: `discovery:${request.executionJobId}`,
      executionJobId: request.executionJobId,
      runId: request.runId,
      workspaceId: request.workspaceId,
      backendFamily: "comfyui",
      discoveredAt,
      outputs: discoveredOutputs,
      summary: {
        discoveredCount: discoveredOutputs.length,
        matchedSlotCount: discoveredOutputs.filter((entry) => entry.slotMatch?.status !== "unmatched").length,
        unmatchedSlotCount: discoveredOutputs.filter((entry) => entry.slotMatch?.status === "unmatched").length,
      },
      metadata: {
        backendExecutionId: request.backendExecutionId,
        malformedArtifactCount,
        ...(request.metadata ?? {}),
      },
    });

    const records = discoveredOutputs.map((entry, index): ImageManipulationCollectedOutputRecord => Object.freeze({
      descriptorId: entry.descriptorId,
      temporaryReference: entry.temporaryReference,
      persistence: Object.freeze({
        status: ImageManipulationOutputPersistenceStatuses.notPersisted,
        reason: "awaiting-managed-asset-persistence",
      }),
      previewCandidate: index === 0 || entry.outputRole === ImageManipulationOutputRoles.primary,
      metadata: Object.freeze({
        slotMatchStatus: entry.slotMatch?.status ?? "unmatched",
      }),
    }));

    const missingOutputs = discoveredOutputs.length === 0;
    const hasMalformedArtifacts = malformedArtifactCount > 0;
    const collectionFailure = missingOutputs || hasMalformedArtifacts
      ? createImageManipulationOutputCollectionFailure({
        failedAt: discoveredAt,
        backendErrorCode: missingOutputs
          ? "missing-backend-outputs"
          : "malformed-backend-output-reference",
        rawMessage: missingOutputs
          ? "ComfyUI job completed without discoverable image outputs."
          : "ComfyUI job produced malformed output artifacts that could not be collected.",
        diagnostics: {
          backendExecutionId: request.backendExecutionId,
          malformedArtifactCount,
          discoveredOutputCount: discoveredOutputs.length,
        },
        stageCode: "output-collection",
        partialProgressObserved: !missingOutputs,
        partialOutputCount: discoveredOutputs.length,
      })
      : undefined;

    const status = missingOutputs
      ? ImageManipulationCollectedExecutionStatuses.failed
      : hasMalformedArtifacts
        ? ImageManipulationCollectedExecutionStatuses.partiallyCollected
        : ImageManipulationCollectedExecutionStatuses.collected;

    const collected = validateImageManipulationCollectedExecutionResult({
      collectionId: `collection:${request.executionJobId}`,
      discoveryId: discovery.discoveryId,
      executionJobId: request.executionJobId,
      runId: request.runId,
      workspaceId: request.workspaceId,
      collectedAt: discoveredAt,
      status,
      collectionFailure,
      discoveredOutputs: discovery.outputs,
      records,
      summary: {
        discoveredCount: discovery.outputs.length,
        collectedCount: records.length,
        persistedCount: 0,
        notPersistedCount: records.length,
        failedCount: 0,
      },
      metadata: {
        backendExecutionId: request.backendExecutionId,
        ...(request.metadata ?? {}),
      },
    });

    return Object.freeze({
      discovery,
      collected,
    });
  }

  private toDiscoveredDescriptor(input: {
    readonly request: ComfyUiOutputDiscoveryCollectionRequest;
    readonly artifact: NormalizedImageArtifact;
    readonly outputIndex: number;
    readonly discoveredAt: string;
    readonly expectedOutputs: ReadonlyArray<ComfyUiExpectedOutputBinding>;
  }): ImageManipulationDiscoveredOutputDescriptor {
    const slotMatch = resolveSlotMatch({
      artifact: input.artifact,
      expectedOutputs: input.expectedOutputs,
      outputIndex: input.outputIndex,
    });
    const extension = readExtension(input.artifact.filename);
    const media = this.createMediaMetadata(extension);
    return Object.freeze({
      descriptorId: `descriptor:${input.request.executionJobId}:${input.artifact.nodeId}:${input.outputIndex}`,
      discoveredAt: input.discoveredAt,
      outputRole: input.outputIndex === 0 ? ImageManipulationOutputRoles.primary : ImageManipulationOutputRoles.variant,
      outputIndex: input.outputIndex,
      outputGroupId: `group:${input.request.executionJobId}`,
      slotMatch,
      media,
      temporaryReference: Object.freeze({
        kind: ImageManipulationTemporaryBackendReferenceKinds.backendObjectHandle,
        backendFamily: "comfyui",
        backendExecutionId: input.request.backendExecutionId,
        backendOutputId: `${input.artifact.nodeId}:${input.artifact.outputIndex}`,
        objectHandle: toBackendObjectHandle(input.artifact),
        metadata: Object.freeze({
          nodeId: input.artifact.nodeId,
          outputType: input.artifact.type,
          subfolder: input.artifact.subfolder,
          filename: input.artifact.filename,
        }),
      }),
      metadata: Object.freeze({
        backendNodeId: input.artifact.nodeId,
        backendOutputIndex: input.artifact.outputIndex,
      }),
    });
  }

  private createMediaMetadata(extension: string | undefined): ImageManipulationOutputMediaMetadata {
    return Object.freeze({
      mediaKind: ImageManipulationOutputMediaKinds.image,
      mimeType: extensionToMimeType(extension),
      extension,
    });
  }

  private resolveTimestamp(candidate: string | undefined): string {
    if (!candidate) {
      return this.now().toISOString();
    }
    const parsed = Date.parse(candidate);
    if (!Number.isFinite(parsed)) {
      return this.now().toISOString();
    }
    return new Date(parsed).toISOString();
  }
}

function extractImageArtifacts(
  historyEntry: ComfyHistoryPromptEntryDto | undefined,
): ReadonlyArray<NormalizedImageArtifact> {
  const outputs = historyEntry?.outputs;
  if (!outputs) {
    return Object.freeze([]);
  }

  const normalized: NormalizedImageArtifact[] = [];
  for (const [nodeId, output] of Object.entries(outputs)) {
    const artifacts = output?.images;
    if (!Array.isArray(artifacts)) {
      continue;
    }
    artifacts.forEach((artifact, index) => {
      if (!artifact || typeof artifact !== "object") {
        return;
      }
      const filename = normalizeString(artifact.filename);
      if (!filename || looksLikeUnsafeFilesystemPath(filename)) {
        return;
      }
      normalized.push(Object.freeze({
        nodeId,
        outputIndex: index,
        filename,
        subfolder: normalizeString(artifact.subfolder),
        type: normalizeString(artifact.type),
      }));
    });
  }
  return Object.freeze(normalized);
}

function countMalformedImageArtifacts(
  historyEntry: ComfyHistoryPromptEntryDto | undefined,
): number {
  const outputs = historyEntry?.outputs;
  if (!outputs) {
    return 0;
  }

  let malformed = 0;
  for (const output of Object.values(outputs)) {
    const artifacts = output?.images;
    if (!Array.isArray(artifacts)) {
      continue;
    }
    artifacts.forEach((artifact) => {
      if (!artifact || typeof artifact !== "object") {
        malformed += 1;
        return;
      }
      const filename = normalizeString(artifact.filename);
      if (!filename || looksLikeUnsafeFilesystemPath(filename)) {
        malformed += 1;
      }
    });
  }
  return malformed;
}

function resolveSlotMatch(input: {
  readonly artifact: NormalizedImageArtifact;
  readonly expectedOutputs: ReadonlyArray<ComfyUiExpectedOutputBinding>;
  readonly outputIndex: number;
}): ImageManipulationOutputSlotMatch {
  const expected = input.expectedOutputs;
  if (expected.length === 0) {
    return Object.freeze({
      status: ImageManipulationOutputSlotMatchStatuses.unmatched,
      expectedBackendField: undefined,
    });
  }

  const matched = expected.find((entry) => {
    const backendField = normalizeString(entry.backendField);
    return backendField
      ? backendFieldContainsNodeHint(backendField, input.artifact.nodeId)
      : false;
  });
  if (matched) {
    return Object.freeze({
      status: ImageManipulationOutputSlotMatchStatuses.matched,
      outputId: matched.outputId,
      expectedBackendField: normalizeString(matched.backendField),
      logicalTargetReference: normalizeString(matched.logicalTargetReference),
    });
  }

  const fallback = expected[input.outputIndex];
  if (fallback) {
    return Object.freeze({
      status: ImageManipulationOutputSlotMatchStatuses.fallback,
      outputId: fallback.outputId,
      expectedBackendField: normalizeString(fallback.backendField),
      logicalTargetReference: normalizeString(fallback.logicalTargetReference),
    });
  }

  return Object.freeze({
    status: ImageManipulationOutputSlotMatchStatuses.unmatched,
  });
}

function toBackendObjectHandle(artifact: NormalizedImageArtifact): string {
  const subfolder = normalizeString(artifact.subfolder);
  const type = normalizeString(artifact.type) ?? "output";
  const target = subfolder ? `${subfolder}/${artifact.filename}` : artifact.filename;
  return `comfy-output:${type}:${target}`;
}

function readExtension(filename: string | undefined): string | undefined {
  const value = normalizeString(filename);
  if (!value) {
    return undefined;
  }
  const parts = value.split(".");
  if (parts.length < 2) {
    return undefined;
  }
  const extension = parts[parts.length - 1]?.trim().toLowerCase();
  return extension || undefined;
}

function extensionToMimeType(extension: string | undefined): string {
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "avif":
      return "image/avif";
    case "tif":
    case "tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

function backendFieldContainsNodeHint(backendField: string, nodeId: string): boolean {
  const tokens = backendField
    .split(/[^A-Za-z0-9_-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.includes(nodeId);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function looksLikeUnsafeFilesystemPath(value: string): boolean {
  return value.startsWith("/")
    || value.startsWith("./")
    || value.startsWith("../")
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.includes("\\");
}
