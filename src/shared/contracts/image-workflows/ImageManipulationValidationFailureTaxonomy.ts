export class ImageManipulationTaxonomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageManipulationTaxonomyError";
  }
}

export const ImageManipulationIssueLayers = Object.freeze({
  assetIngestion: "asset-ingestion",
  workflowConfiguration: "workflow-configuration",
  runReadiness: "run-readiness",
  executionDispatch: "execution-dispatch",
  nodeAvailability: "node-availability",
  resultCollection: "result-collection",
  previewGeneration: "preview-generation",
  protectedRetrieval: "protected-retrieval",
} as const);

export type ImageManipulationIssueLayer =
  typeof ImageManipulationIssueLayers[keyof typeof ImageManipulationIssueLayers];

export const ImageManipulationIssueKinds = Object.freeze({
  validation: "validation",
  operational: "operational",
} as const);

export type ImageManipulationIssueKind =
  typeof ImageManipulationIssueKinds[keyof typeof ImageManipulationIssueKinds];

export const ImageManipulationIssueResolutionActors = Object.freeze({
  user: "user",
  operator: "operator",
  platform: "platform",
} as const);

export type ImageManipulationIssueResolutionActor =
  typeof ImageManipulationIssueResolutionActors[keyof typeof ImageManipulationIssueResolutionActors];

export const ImageManipulationFailureDispositions = Object.freeze({
  retryable: "retryable",
  terminal: "terminal",
} as const);

export type ImageManipulationFailureDisposition =
  typeof ImageManipulationFailureDispositions[keyof typeof ImageManipulationFailureDispositions];

export const ImageManipulationFailureSummaryCategories = Object.freeze({
  validation: "validation",
  translation: "translation",
  dependency: "dependency",
  capacity: "capacity",
  timeout: "timeout",
  cancellation: "cancellation",
  execution: "execution",
  output: "output",
  connectivity: "connectivity",
  internal: "internal",
  unknown: "unknown",
} as const);

export type ImageManipulationFailureSummaryCategory =
  typeof ImageManipulationFailureSummaryCategories[keyof typeof ImageManipulationFailureSummaryCategories];

export interface ImageManipulationIssueCodeParts {
  readonly layer: ImageManipulationIssueLayer;
  readonly kind: ImageManipulationIssueKind;
  readonly reason: string;
}

export interface ImageManipulationIssueClassification {
  readonly issueCode: string;
  readonly layer: ImageManipulationIssueLayer;
  readonly kind: ImageManipulationIssueKind;
  readonly summaryCategory: ImageManipulationFailureSummaryCategory;
  readonly disposition: ImageManipulationFailureDisposition;
  readonly resolutionActor: ImageManipulationIssueResolutionActor;
  readonly userFixable: boolean;
  readonly degraded: boolean;
}

const issueCodeLayerSegments: Readonly<Record<ImageManipulationIssueLayer, string>> = Object.freeze({
  [ImageManipulationIssueLayers.assetIngestion]: "ingest",
  [ImageManipulationIssueLayers.workflowConfiguration]: "workflow",
  [ImageManipulationIssueLayers.runReadiness]: "readiness",
  [ImageManipulationIssueLayers.executionDispatch]: "dispatch",
  [ImageManipulationIssueLayers.nodeAvailability]: "node",
  [ImageManipulationIssueLayers.resultCollection]: "result",
  [ImageManipulationIssueLayers.previewGeneration]: "preview",
  [ImageManipulationIssueLayers.protectedRetrieval]: "retrieval",
});

const issueCodeSegmentLayers: Readonly<Record<string, ImageManipulationIssueLayer>> = Object.freeze(
  Object.freeze(
    Object.entries(issueCodeLayerSegments).reduce<Record<string, ImageManipulationIssueLayer>>((acc, [layer, segment]) => {
      acc[segment] = layer as ImageManipulationIssueLayer;
      return acc;
    }, {}),
  ),
);

const reasonPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createImageManipulationIssueCode(parts: ImageManipulationIssueCodeParts): string {
  const normalizedReason = parts.reason.trim().toLowerCase();
  if (!reasonPattern.test(normalizedReason)) {
    throw new ImageManipulationTaxonomyError(
      "Image manipulation issue-code reason must use lowercase kebab-case segments.",
    );
  }
  const layerSegment = issueCodeLayerSegments[parts.layer];
  return `im.${layerSegment}.${parts.kind}.${normalizedReason}`;
}

export function parseImageManipulationIssueCode(
  value: string | undefined,
): ImageManipulationIssueCodeParts | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const match = normalized.match(/^im\.([a-z0-9-]+)\.(validation|operational)\.([a-z0-9-]+)$/);
  if (!match) {
    return undefined;
  }
  const layer = issueCodeSegmentLayers[match[1] ?? ""];
  if (!layer) {
    return undefined;
  }
  const reason = match[3] ?? "";
  if (!reasonPattern.test(reason)) {
    return undefined;
  }
  return Object.freeze({
    layer,
    kind: match[2] as ImageManipulationIssueKind,
    reason,
  });
}

function resolveResolutionActor(input: {
  readonly kind: ImageManipulationIssueKind;
  readonly summaryCategory: ImageManipulationFailureSummaryCategory;
  readonly userFixable: boolean;
  readonly degraded: boolean;
}): ImageManipulationIssueResolutionActor {
  if (input.userFixable) {
    return ImageManipulationIssueResolutionActors.user;
  }
  if (input.kind === ImageManipulationIssueKinds.validation) {
    return ImageManipulationIssueResolutionActors.user;
  }
  if (
    input.summaryCategory === ImageManipulationFailureSummaryCategories.internal
    || input.summaryCategory === ImageManipulationFailureSummaryCategories.execution
    || input.summaryCategory === ImageManipulationFailureSummaryCategories.unknown
  ) {
    return ImageManipulationIssueResolutionActors.platform;
  }
  if (input.degraded) {
    return ImageManipulationIssueResolutionActors.operator;
  }
  return ImageManipulationIssueResolutionActors.operator;
}

export function createImageManipulationIssueClassification(input: {
  readonly layer: ImageManipulationIssueLayer;
  readonly kind: ImageManipulationIssueKind;
  readonly summaryCategory: ImageManipulationFailureSummaryCategory;
  readonly disposition: ImageManipulationFailureDisposition;
  readonly reason: string;
  readonly userFixable?: boolean;
  readonly degraded?: boolean;
}): ImageManipulationIssueClassification {
  const userFixable = input.userFixable ?? input.kind === ImageManipulationIssueKinds.validation;
  const degraded = Boolean(input.degraded);
  return Object.freeze({
    issueCode: createImageManipulationIssueCode({
      layer: input.layer,
      kind: input.kind,
      reason: input.reason,
    }),
    layer: input.layer,
    kind: input.kind,
    summaryCategory: input.summaryCategory,
    disposition: input.disposition,
    resolutionActor: resolveResolutionActor({
      kind: input.kind,
      summaryCategory: input.summaryCategory,
      userFixable,
      degraded,
    }),
    userFixable,
    degraded,
  });
}
