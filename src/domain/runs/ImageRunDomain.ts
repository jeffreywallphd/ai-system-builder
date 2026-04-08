import { AssetId } from "../assets/AssetId";

export const ImageRunStatuses = Object.freeze({
  draft: "draft",
  requested: "requested",
  validating: "validating",
  queued: "queued",
  dispatching: "dispatching",
  running: "running",
  degraded: "degraded",
  partiallyCompleted: "partially-completed",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type ImageRunStatus = typeof ImageRunStatuses[keyof typeof ImageRunStatuses];

export interface ImageRunIdentity {
  readonly runId: string;
  readonly workspaceId: string;
  readonly ownerUserId: string;
}

export interface ImageRunCompositionReference {
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
}

export interface ImageRunInputAssetBinding {
  readonly bindingId: string;
  readonly role: string;
  readonly assetId: AssetId;
  readonly assetVersionId?: string;
}

export interface ImageRunStatusTimestamps {
  readonly requestedAt?: string;
  readonly validatedAt?: string;
  readonly queuedAt?: string;
  readonly dispatchingAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly cancelledAt?: string;
  readonly degradedAt?: string;
  readonly partiallyCompletedAt?: string;
}

export interface ImageRunFailureSummary {
  readonly code: string;
  readonly message: string;
  readonly failedAt: string;
  readonly recoverable: boolean;
}

export interface ImageRunExecutionLinkage {
  readonly queueId?: string;
  readonly dispatchId?: string;
  readonly nodeId?: string;
  readonly adapterKind?: string;
  readonly adapterRunId?: string;
}

export interface ImageRunResultLineage {
  readonly outputAssetIds: ReadonlyArray<AssetId>;
  readonly parentRunId?: string;
}

export interface ImageRunStatusHistoryEntry {
  readonly status: ImageRunStatus;
  readonly changedAt: string;
  readonly changedBy: string;
  readonly reason?: string;
}

export interface ImageRunRecord {
  readonly identity: ImageRunIdentity;
  readonly composition: ImageRunCompositionReference;
  readonly inputAssetBindings: ReadonlyArray<ImageRunInputAssetBinding>;
  readonly parameterSnapshot: Readonly<Record<string, unknown>>;
  readonly status: ImageRunStatus;
  readonly statusTimestamps: ImageRunStatusTimestamps;
  readonly statusHistory: ReadonlyArray<ImageRunStatusHistoryEntry>;
  readonly executionLinkage: ImageRunExecutionLinkage;
  readonly failureSummary?: ImageRunFailureSummary;
  readonly resultLineage?: ImageRunResultLineage;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
}

export class ImageRunDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRunDomainError";
  }
}

export class ImageRunLifecycleTransitionError extends ImageRunDomainError {
  constructor(from: ImageRunStatus, to: ImageRunStatus) {
    super(`Image run lifecycle cannot transition from '${from}' to '${to}'.`);
    this.name = "ImageRunLifecycleTransitionError";
  }
}

const lifecycleTransitions = {
  [ImageRunStatuses.draft]: Object.freeze([ImageRunStatuses.requested, ImageRunStatuses.cancelled]),
  [ImageRunStatuses.requested]: Object.freeze([ImageRunStatuses.validating, ImageRunStatuses.cancelled]),
  [ImageRunStatuses.validating]: Object.freeze([ImageRunStatuses.queued, ImageRunStatuses.failed, ImageRunStatuses.cancelled]),
  [ImageRunStatuses.queued]: Object.freeze([ImageRunStatuses.dispatching, ImageRunStatuses.failed, ImageRunStatuses.cancelled]),
  [ImageRunStatuses.dispatching]: Object.freeze([ImageRunStatuses.running, ImageRunStatuses.queued, ImageRunStatuses.failed, ImageRunStatuses.cancelled]),
  [ImageRunStatuses.running]: Object.freeze([
    ImageRunStatuses.degraded,
    ImageRunStatuses.partiallyCompleted,
    ImageRunStatuses.completed,
    ImageRunStatuses.failed,
    ImageRunStatuses.cancelled,
  ]),
  [ImageRunStatuses.degraded]: Object.freeze([
    ImageRunStatuses.running,
    ImageRunStatuses.partiallyCompleted,
    ImageRunStatuses.completed,
    ImageRunStatuses.failed,
    ImageRunStatuses.cancelled,
  ]),
  [ImageRunStatuses.partiallyCompleted]: Object.freeze([
    ImageRunStatuses.completed,
    ImageRunStatuses.failed,
    ImageRunStatuses.cancelled,
  ]),
  [ImageRunStatuses.completed]: Object.freeze([]),
  [ImageRunStatuses.failed]: Object.freeze([]),
  [ImageRunStatuses.cancelled]: Object.freeze([]),
} as const satisfies Record<ImageRunStatus, ReadonlyArray<ImageRunStatus>>;

export const ImageRunLifecycleTransitions: Readonly<Record<ImageRunStatus, ReadonlyArray<ImageRunStatus>>> =
  Object.freeze(lifecycleTransitions);

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageRunDomainError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, label: string): string {
  const normalized = normalizeRequired(value, label);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new ImageRunDomainError(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
}

function normalizeStatus(status: ImageRunStatus): ImageRunStatus {
  if (!Object.values(ImageRunStatuses).includes(status)) {
    throw new ImageRunDomainError(`Image run status '${String(status)}' is invalid.`);
  }
  return status;
}

function ensureCanonicalAssetId(value: AssetId, label: string): AssetId {
  const normalized = AssetId.from(value);
  if (!normalized.toString().startsWith("asset:")) {
    throw new ImageRunDomainError(`${label} '${normalized.toString()}' must use canonical asset id format.`);
  }
  return normalized;
}

function normalizeInputBindings(
  values: ReadonlyArray<ImageRunInputAssetBinding>,
): ReadonlyArray<ImageRunInputAssetBinding> {
  const seenBindingIds = new Set<string>();

  const normalized = values.map((entry) => {
    const bindingId = normalizeRequired(entry.bindingId, "Image run input binding id");
    if (seenBindingIds.has(bindingId)) {
      throw new ImageRunDomainError(`Image run input binding id '${bindingId}' is duplicated.`);
    }
    seenBindingIds.add(bindingId);

    const assetVersionId = normalizeOptional(entry.assetVersionId);
    if (assetVersionId !== undefined && !/^[a-zA-Z0-9:_-]+$/.test(assetVersionId)) {
      throw new ImageRunDomainError(`Image run input binding assetVersionId '${assetVersionId}' is malformed.`);
    }

    return Object.freeze({
      bindingId,
      role: normalizeRequired(entry.role, "Image run input binding role"),
      assetId: ensureCanonicalAssetId(entry.assetId, "Image run input binding assetId"),
      assetVersionId,
    });
  });

  if (normalized.length === 0) {
    throw new ImageRunDomainError("Image run input asset bindings must include at least one bound logical asset.");
  }

  return Object.freeze(normalized);
}

function freezeJsonValue(value: unknown, path: string): unknown {
  if (value === null) {
    return null;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return value;
  }

  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new ImageRunDomainError(`Image run parameter snapshot at '${path}' must not contain non-finite numbers.`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry, index) => freezeJsonValue(entry, `${path}[${index}]`)));
  }

  if (valueType === "object") {
    const objectValue = value as Record<string, unknown>;
    const normalizedEntries = Object.entries(objectValue).map(([key, nested]) => {
      if (!key.trim()) {
        throw new ImageRunDomainError(`Image run parameter snapshot at '${path}' contains an empty object key.`);
      }
      return [key, freezeJsonValue(nested, `${path}.${key}`)] as const;
    });
    return Object.freeze(Object.fromEntries(normalizedEntries));
  }

  throw new ImageRunDomainError(`Image run parameter snapshot at '${path}' contains unsupported value type '${valueType}'.`);
}

function normalizeParameterSnapshot(
  snapshot: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== "object") {
    throw new ImageRunDomainError("Image run parameter snapshot must be an object.");
  }

  return freezeJsonValue(snapshot, "parameters") as Readonly<Record<string, unknown>>;
}

function normalizeStatusTimestamps(
  status: ImageRunStatus,
  value: ImageRunStatusTimestamps,
  createdAt: string,
  updatedAt: string,
): ImageRunStatusTimestamps {
  const requestedAt = value.requestedAt ? normalizeIsoTimestamp(value.requestedAt, "Image run requestedAt") : undefined;
  const validatedAt = value.validatedAt ? normalizeIsoTimestamp(value.validatedAt, "Image run validatedAt") : undefined;
  const queuedAt = value.queuedAt ? normalizeIsoTimestamp(value.queuedAt, "Image run queuedAt") : undefined;
  const dispatchingAt = value.dispatchingAt ? normalizeIsoTimestamp(value.dispatchingAt, "Image run dispatchingAt") : undefined;
  const startedAt = value.startedAt ? normalizeIsoTimestamp(value.startedAt, "Image run startedAt") : undefined;
  const completedAt = value.completedAt ? normalizeIsoTimestamp(value.completedAt, "Image run completedAt") : undefined;
  const failedAt = value.failedAt ? normalizeIsoTimestamp(value.failedAt, "Image run failedAt") : undefined;
  const cancelledAt = value.cancelledAt ? normalizeIsoTimestamp(value.cancelledAt, "Image run cancelledAt") : undefined;
  const degradedAt = value.degradedAt ? normalizeIsoTimestamp(value.degradedAt, "Image run degradedAt") : undefined;
  const partiallyCompletedAt = value.partiallyCompletedAt
    ? normalizeIsoTimestamp(value.partiallyCompletedAt, "Image run partiallyCompletedAt")
    : undefined;

  const statusesAtOrBeyondRequested = new Set<ImageRunStatus>([
    ImageRunStatuses.requested,
    ImageRunStatuses.validating,
    ImageRunStatuses.queued,
    ImageRunStatuses.dispatching,
    ImageRunStatuses.running,
    ImageRunStatuses.degraded,
    ImageRunStatuses.partiallyCompleted,
    ImageRunStatuses.completed,
    ImageRunStatuses.failed,
    ImageRunStatuses.cancelled,
  ]);
  const statusesAtOrBeyondValidating = new Set<ImageRunStatus>([
    ImageRunStatuses.validating,
    ImageRunStatuses.queued,
    ImageRunStatuses.dispatching,
    ImageRunStatuses.running,
    ImageRunStatuses.degraded,
    ImageRunStatuses.partiallyCompleted,
    ImageRunStatuses.completed,
    ImageRunStatuses.failed,
    ImageRunStatuses.cancelled,
  ]);
  const statusesAtOrBeyondQueued = new Set<ImageRunStatus>([
    ImageRunStatuses.queued,
    ImageRunStatuses.dispatching,
    ImageRunStatuses.running,
    ImageRunStatuses.degraded,
    ImageRunStatuses.partiallyCompleted,
    ImageRunStatuses.completed,
    ImageRunStatuses.failed,
    ImageRunStatuses.cancelled,
  ]);
  const statusesAtOrBeyondDispatching = new Set<ImageRunStatus>([
    ImageRunStatuses.dispatching,
    ImageRunStatuses.running,
    ImageRunStatuses.degraded,
    ImageRunStatuses.partiallyCompleted,
    ImageRunStatuses.completed,
  ]);

  if (statusesAtOrBeyondRequested.has(status) && !requestedAt) {
    throw new ImageRunDomainError(`Image run status '${status}' requires requestedAt.`);
  }
  if (statusesAtOrBeyondValidating.has(status) && !validatedAt) {
    throw new ImageRunDomainError(`Image run status '${status}' requires validatedAt.`);
  }
  if (statusesAtOrBeyondQueued.has(status) && !queuedAt) {
    throw new ImageRunDomainError(`Image run status '${status}' requires queuedAt.`);
  }
  if (statusesAtOrBeyondDispatching.has(status) && !dispatchingAt) {
    throw new ImageRunDomainError(`Image run status '${status}' requires dispatchingAt.`);
  }

  if (status === ImageRunStatuses.running || status === ImageRunStatuses.degraded
    || status === ImageRunStatuses.partiallyCompleted || status === ImageRunStatuses.completed) {
    if (!startedAt) {
      throw new ImageRunDomainError(`Image run status '${status}' requires startedAt.`);
    }
  }

  if (status === ImageRunStatuses.completed && !completedAt) {
    throw new ImageRunDomainError("Completed image runs require completedAt.");
  }
  if (status === ImageRunStatuses.partiallyCompleted && !partiallyCompletedAt) {
    throw new ImageRunDomainError("Partially-completed image runs require partiallyCompletedAt.");
  }
  if (status === ImageRunStatuses.failed && !failedAt) {
    throw new ImageRunDomainError("Failed image runs require failedAt.");
  }
  if (status === ImageRunStatuses.cancelled && !cancelledAt) {
    throw new ImageRunDomainError("Cancelled image runs require cancelledAt.");
  }
  if (status === ImageRunStatuses.degraded && !degradedAt) {
    throw new ImageRunDomainError("Degraded image runs require degradedAt.");
  }

  if (requestedAt && Date.parse(requestedAt) < Date.parse(createdAt)) {
    throw new ImageRunDomainError("Image run requestedAt cannot be earlier than createdAt.");
  }
  if (validatedAt && requestedAt && Date.parse(validatedAt) < Date.parse(requestedAt)) {
    throw new ImageRunDomainError("Image run validatedAt cannot be earlier than requestedAt.");
  }
  if (queuedAt && validatedAt && Date.parse(queuedAt) < Date.parse(validatedAt)) {
    throw new ImageRunDomainError("Image run queuedAt cannot be earlier than validatedAt.");
  }
  if (dispatchingAt && queuedAt && Date.parse(dispatchingAt) < Date.parse(queuedAt)) {
    throw new ImageRunDomainError("Image run dispatchingAt cannot be earlier than queuedAt.");
  }
  if (startedAt && dispatchingAt && Date.parse(startedAt) < Date.parse(dispatchingAt)) {
    throw new ImageRunDomainError("Image run startedAt cannot be earlier than dispatchingAt.");
  }
  if (degradedAt && startedAt && Date.parse(degradedAt) < Date.parse(startedAt)) {
    throw new ImageRunDomainError("Image run degradedAt cannot be earlier than startedAt.");
  }
  if (partiallyCompletedAt && startedAt && Date.parse(partiallyCompletedAt) < Date.parse(startedAt)) {
    throw new ImageRunDomainError("Image run partiallyCompletedAt cannot be earlier than startedAt.");
  }
  if (completedAt && startedAt && Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new ImageRunDomainError("Image run completedAt cannot be earlier than startedAt.");
  }
  if (failedAt && requestedAt && Date.parse(failedAt) < Date.parse(requestedAt)) {
    throw new ImageRunDomainError("Image run failedAt cannot be earlier than requestedAt.");
  }
  if (cancelledAt && requestedAt && Date.parse(cancelledAt) < Date.parse(requestedAt)) {
    throw new ImageRunDomainError("Image run cancelledAt cannot be earlier than requestedAt.");
  }

  for (const [label, timestamp] of Object.entries({
    requestedAt,
    validatedAt,
    queuedAt,
    dispatchingAt,
    startedAt,
    degradedAt,
    partiallyCompletedAt,
    completedAt,
    failedAt,
    cancelledAt,
  })) {
    if (timestamp && Date.parse(timestamp) > Date.parse(updatedAt)) {
      throw new ImageRunDomainError(`Image run ${label} cannot be later than updatedAt.`);
    }
  }

  return Object.freeze({
    requestedAt,
    validatedAt,
    queuedAt,
    dispatchingAt,
    startedAt,
    completedAt,
    failedAt,
    cancelledAt,
    degradedAt,
    partiallyCompletedAt,
  });
}

function normalizeExecutionLinkage(status: ImageRunStatus, value: ImageRunExecutionLinkage): ImageRunExecutionLinkage {
  const queueId = normalizeOptional(value.queueId);
  const dispatchId = normalizeOptional(value.dispatchId);
  const nodeId = normalizeOptional(value.nodeId);
  const adapterKind = normalizeOptional(value.adapterKind);
  const adapterRunId = normalizeOptional(value.adapterRunId);

  if ((status === ImageRunStatuses.dispatching || status === ImageRunStatuses.running
    || status === ImageRunStatuses.degraded || status === ImageRunStatuses.partiallyCompleted
    || status === ImageRunStatuses.completed) && !dispatchId) {
    throw new ImageRunDomainError(`Image run status '${status}' requires executionLinkage.dispatchId.`);
  }

  if ((status === ImageRunStatuses.running || status === ImageRunStatuses.degraded
    || status === ImageRunStatuses.partiallyCompleted || status === ImageRunStatuses.completed)
    && (!adapterKind || !adapterRunId)) {
    throw new ImageRunDomainError(`Image run status '${status}' requires adapterKind and adapterRunId.`);
  }

  if ((status === ImageRunStatuses.draft || status === ImageRunStatuses.requested || status === ImageRunStatuses.validating)
    && (dispatchId || nodeId || adapterKind || adapterRunId)) {
    throw new ImageRunDomainError(`Image run status '${status}' cannot include dispatch or adapter linkage metadata.`);
  }

  return Object.freeze({
    queueId,
    dispatchId,
    nodeId,
    adapterKind,
    adapterRunId,
  });
}

function normalizeFailureSummary(status: ImageRunStatus, value?: ImageRunFailureSummary): ImageRunFailureSummary | undefined {
  const requiresFailureSummary = status === ImageRunStatuses.failed
    || status === ImageRunStatuses.degraded
    || status === ImageRunStatuses.partiallyCompleted;

  if (!requiresFailureSummary) {
    if (value) {
      throw new ImageRunDomainError(`Image run status '${status}' cannot include failureSummary.`);
    }
    return undefined;
  }

  if (!value) {
    throw new ImageRunDomainError(`Image run status '${status}' requires failureSummary.`);
  }

  return Object.freeze({
    code: normalizeRequired(value.code, "Image run failure summary code"),
    message: normalizeRequired(value.message, "Image run failure summary message"),
    failedAt: normalizeIsoTimestamp(value.failedAt, "Image run failure summary failedAt"),
    recoverable: value.recoverable,
  });
}

function normalizeResultLineage(value?: ImageRunResultLineage): ImageRunResultLineage | undefined {
  if (!value) {
    return undefined;
  }

  const parentRunId = normalizeOptional(value.parentRunId);
  const outputAssetIds = Object.freeze([
    ...new Set(value.outputAssetIds.map((entry) => ensureCanonicalAssetId(entry, "Image run output assetId").toString())),
  ]).map((entry) => new AssetId(entry));

  if (outputAssetIds.length === 0) {
    throw new ImageRunDomainError("Image run result lineage must include at least one outputAssetId.");
  }

  return Object.freeze({
    outputAssetIds: Object.freeze(outputAssetIds),
    parentRunId,
  });
}

function normalizeStatusHistory(
  entries: ReadonlyArray<ImageRunStatusHistoryEntry> | undefined,
  defaults: {
    readonly status: ImageRunStatus;
    readonly changedAt: string;
    readonly changedBy: string;
  },
  createdAt: string,
  updatedAt: string,
): ReadonlyArray<ImageRunStatusHistoryEntry> {
  const sourceEntries = entries && entries.length > 0
    ? entries
    : [
      {
        status: defaults.status,
        changedAt: defaults.changedAt,
        changedBy: defaults.changedBy,
      },
    ];

  let previousChangedAt: string | undefined;
  const normalized = sourceEntries.map((entry, index) => {
    const status = normalizeStatus(entry.status);
    const changedAt = normalizeIsoTimestamp(entry.changedAt, `Image run statusHistory[${index}] changedAt`);
    const changedBy = normalizeRequired(entry.changedBy, `Image run statusHistory[${index}] changedBy`);

    if (Date.parse(changedAt) < Date.parse(createdAt)) {
      throw new ImageRunDomainError("Image run status history changedAt cannot be earlier than createdAt.");
    }
    if (Date.parse(changedAt) > Date.parse(updatedAt)) {
      throw new ImageRunDomainError("Image run status history changedAt cannot be later than updatedAt.");
    }
    if (previousChangedAt && Date.parse(changedAt) < Date.parse(previousChangedAt)) {
      throw new ImageRunDomainError("Image run status history must be chronological.");
    }

    previousChangedAt = changedAt;

    return Object.freeze({
      status,
      changedAt,
      changedBy,
      reason: normalizeOptional(entry.reason),
    });
  });

  if (normalized.at(-1)?.status !== defaults.status) {
    throw new ImageRunDomainError("Image run status history must end with the current status.");
  }

  return Object.freeze(normalized);
}

function assertFailureSummaryTimingCoherence(
  timestamps: ImageRunStatusTimestamps,
  failureSummary: ImageRunFailureSummary | undefined,
): void {
  if (!failureSummary) {
    return;
  }

  const statusFailureAt = timestamps.failedAt
    ?? timestamps.degradedAt
    ?? timestamps.partiallyCompletedAt;

  if (statusFailureAt && failureSummary.failedAt !== statusFailureAt) {
    throw new ImageRunDomainError("Image run failureSummary.failedAt must match status timestamp for failed/degraded/partial states.");
  }
}

export function isImageRunLifecycleTransitionAllowed(from: ImageRunStatus, to: ImageRunStatus): boolean {
  const normalizedFrom = normalizeStatus(from);
  const normalizedTo = normalizeStatus(to);

  if (normalizedFrom === normalizedTo) {
    return true;
  }

  return ImageRunLifecycleTransitions[normalizedFrom].includes(normalizedTo);
}

export function createImageRunRecord(input: {
  readonly identity: ImageRunIdentity;
  readonly composition: ImageRunCompositionReference;
  readonly inputAssetBindings: ReadonlyArray<ImageRunInputAssetBinding>;
  readonly parameterSnapshot: Readonly<Record<string, unknown>>;
  readonly status?: ImageRunStatus;
  readonly statusTimestamps?: ImageRunStatusTimestamps;
  readonly statusHistory?: ReadonlyArray<ImageRunStatusHistoryEntry>;
  readonly executionLinkage?: ImageRunExecutionLinkage;
  readonly failureSummary?: ImageRunFailureSummary;
  readonly resultLineage?: ImageRunResultLineage;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly createdBy: string;
  readonly lastModifiedBy?: string;
}): ImageRunRecord {
  const status = normalizeStatus(input.status ?? ImageRunStatuses.draft);
  const createdAt = normalizeIsoTimestamp(input.createdAt, "Image run createdAt");
  const updatedAt = normalizeIsoTimestamp(input.updatedAt ?? input.createdAt, "Image run updatedAt");

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new ImageRunDomainError("Image run updatedAt cannot be earlier than createdAt.");
  }

  const createdBy = normalizeRequired(input.createdBy, "Image run createdBy");
  const lastModifiedBy = normalizeRequired(input.lastModifiedBy ?? createdBy, "Image run lastModifiedBy");

  const statusTimestamps = normalizeStatusTimestamps(status, input.statusTimestamps ?? {}, createdAt, updatedAt);
  const failureSummary = normalizeFailureSummary(status, input.failureSummary);
  assertFailureSummaryTimingCoherence(statusTimestamps, failureSummary);

  const record = Object.freeze({
    identity: Object.freeze({
      runId: normalizeRequired(input.identity.runId, "Image run id"),
      workspaceId: normalizeRequired(input.identity.workspaceId, "Image run workspaceId"),
      ownerUserId: normalizeRequired(input.identity.ownerUserId, "Image run ownerUserId"),
    }),
    composition: Object.freeze({
      systemId: normalizeRequired(input.composition.systemId, "Image run systemId"),
      workflowId: normalizeRequired(input.composition.workflowId, "Image run workflowId"),
      workflowTemplateId: normalizeOptional(input.composition.workflowTemplateId),
    }),
    inputAssetBindings: normalizeInputBindings(input.inputAssetBindings),
    parameterSnapshot: normalizeParameterSnapshot(input.parameterSnapshot),
    status,
    statusTimestamps,
    statusHistory: normalizeStatusHistory(input.statusHistory, {
      status,
      changedAt: updatedAt,
      changedBy: lastModifiedBy,
    }, createdAt, updatedAt),
    executionLinkage: normalizeExecutionLinkage(status, input.executionLinkage ?? {}),
    failureSummary,
    resultLineage: normalizeResultLineage(input.resultLineage),
    createdAt,
    updatedAt,
    createdBy,
    lastModifiedBy,
  });

  return record;
}

function resolveTransitionStatusTimestamp(
  toStatus: ImageRunStatus,
  existing: ImageRunStatusTimestamps,
  occurredAt: string,
): ImageRunStatusTimestamps {
  switch (toStatus) {
    case ImageRunStatuses.requested:
      return Object.freeze({ ...existing, requestedAt: existing.requestedAt ?? occurredAt });
    case ImageRunStatuses.validating:
      return Object.freeze({
        ...existing,
        requestedAt: existing.requestedAt ?? occurredAt,
        validatedAt: existing.validatedAt ?? occurredAt,
      });
    case ImageRunStatuses.queued:
      return Object.freeze({
        ...existing,
        requestedAt: existing.requestedAt ?? occurredAt,
        validatedAt: existing.validatedAt ?? occurredAt,
        queuedAt: existing.queuedAt ?? occurredAt,
      });
    case ImageRunStatuses.dispatching:
      return Object.freeze({
        ...existing,
        requestedAt: existing.requestedAt ?? occurredAt,
        validatedAt: existing.validatedAt ?? occurredAt,
        queuedAt: existing.queuedAt ?? occurredAt,
        dispatchingAt: existing.dispatchingAt ?? occurredAt,
      });
    case ImageRunStatuses.running:
      return Object.freeze({
        ...existing,
        requestedAt: existing.requestedAt ?? occurredAt,
        validatedAt: existing.validatedAt ?? occurredAt,
        queuedAt: existing.queuedAt ?? occurredAt,
        dispatchingAt: existing.dispatchingAt ?? occurredAt,
        startedAt: existing.startedAt ?? occurredAt,
      });
    case ImageRunStatuses.degraded:
      return Object.freeze({ ...existing, degradedAt: existing.degradedAt ?? occurredAt });
    case ImageRunStatuses.partiallyCompleted:
      return Object.freeze({ ...existing, partiallyCompletedAt: existing.partiallyCompletedAt ?? occurredAt });
    case ImageRunStatuses.completed:
      return Object.freeze({ ...existing, completedAt: existing.completedAt ?? occurredAt });
    case ImageRunStatuses.failed:
      return Object.freeze({ ...existing, failedAt: existing.failedAt ?? occurredAt });
    case ImageRunStatuses.cancelled:
      return Object.freeze({ ...existing, cancelledAt: existing.cancelledAt ?? occurredAt });
    case ImageRunStatuses.draft:
    default:
      return existing;
  }
}

export function transitionImageRunRecord(
  run: ImageRunRecord,
  transition: {
    readonly toStatus: ImageRunStatus;
    readonly occurredAt: string;
    readonly changedBy: string;
    readonly reason?: string;
    readonly executionLinkage?: ImageRunExecutionLinkage;
    readonly failureSummary?: ImageRunFailureSummary;
    readonly resultLineage?: ImageRunResultLineage;
  },
): ImageRunRecord {
  const toStatus = normalizeStatus(transition.toStatus);
  if (toStatus === run.status) {
    throw new ImageRunLifecycleTransitionError(run.status, toStatus);
  }

  if (!isImageRunLifecycleTransitionAllowed(run.status, toStatus)) {
    throw new ImageRunLifecycleTransitionError(run.status, toStatus);
  }

  const occurredAt = normalizeIsoTimestamp(transition.occurredAt, "Image run transition occurredAt");
  if (Date.parse(occurredAt) < Date.parse(run.updatedAt)) {
    throw new ImageRunDomainError("Image run transition occurredAt cannot be earlier than current updatedAt.");
  }

  return createImageRunRecord({
    identity: run.identity,
    composition: run.composition,
    inputAssetBindings: run.inputAssetBindings,
    parameterSnapshot: run.parameterSnapshot,
    status: toStatus,
    statusTimestamps: resolveTransitionStatusTimestamp(toStatus, run.statusTimestamps, occurredAt),
    statusHistory: Object.freeze([
      ...run.statusHistory,
      Object.freeze({
        status: toStatus,
        changedAt: occurredAt,
        changedBy: normalizeRequired(transition.changedBy, "Image run transition changedBy"),
        reason: normalizeOptional(transition.reason),
      }),
    ]),
    executionLinkage: transition.executionLinkage ?? run.executionLinkage,
    failureSummary: transition.failureSummary,
    resultLineage: transition.resultLineage ?? run.resultLineage,
    createdAt: run.createdAt,
    updatedAt: occurredAt,
    createdBy: run.createdBy,
    lastModifiedBy: transition.changedBy,
  });
}
