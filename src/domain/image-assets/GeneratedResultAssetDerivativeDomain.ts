import { type AssetId, createAssetId } from "@domain/assets/AssetDomain";

export class GeneratedResultAssetDerivativeDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedResultAssetDerivativeDomainError";
  }
}

export const GeneratedResultDerivativePresentationRoles = Object.freeze({
  preview: "preview",
  derivative: "derivative",
} as const);

export type GeneratedResultDerivativePresentationRole =
  typeof GeneratedResultDerivativePresentationRoles[keyof typeof GeneratedResultDerivativePresentationRoles];

export const GeneratedResultPreviewKinds = Object.freeze({
  thumbnail: "thumbnail",
  displaySafe: "display-safe",
  historySafe: "history-safe",
} as const);

export type GeneratedResultPreviewKind =
  typeof GeneratedResultPreviewKinds[keyof typeof GeneratedResultPreviewKinds];

export const GeneratedResultDerivativeKinds = Object.freeze({
  thumbnail: "thumbnail",
  displaySafe: "display-safe",
  historySafe: "history-safe",
  transcode: "transcode",
  watermark: "watermark",
  colorManaged: "color-managed",
  custom: "custom",
} as const);

export type GeneratedResultDerivativeKind =
  typeof GeneratedResultDerivativeKinds[keyof typeof GeneratedResultDerivativeKinds];

export const GeneratedResultDerivativeAvailabilityStatuses = Object.freeze({
  pending: "pending",
  available: "available",
  failed: "failed",
  stale: "stale",
} as const);

export type GeneratedResultDerivativeAvailabilityStatus =
  typeof GeneratedResultDerivativeAvailabilityStatuses[keyof typeof GeneratedResultDerivativeAvailabilityStatuses];

export interface GeneratedResultDerivativeDimensions {
  readonly width: number;
  readonly height: number;
}

export interface GeneratedResultDerivativeProtectedAccess {
  readonly protectedResourceId: string;
  readonly accessHandle: string;
  readonly mediaType: string;
  readonly byteSize?: number;
}

export interface GeneratedResultDerivativeAvailabilityMetadata {
  readonly status: GeneratedResultDerivativeAvailabilityStatus;
  readonly generationMode: "deferred" | "on-demand" | "eager";
  readonly generationRevision: number;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly generatedAt?: string;
  readonly generatedBy?: string;
  readonly refreshedAt?: string;
  readonly refreshedBy?: string;
  readonly failedAt?: string;
  readonly failedBy?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly sourceResultVersionId?: string;
}

export interface GeneratedResultAssetDerivativeDescriptor {
  readonly derivativeId: string;
  readonly resultAssetId: AssetId;
  readonly resultLogicalAssetVersionId?: string;
  readonly presentationRole: GeneratedResultDerivativePresentationRole;
  readonly derivativeKind: GeneratedResultDerivativeKind;
  readonly previewKind?: GeneratedResultPreviewKind;
  readonly isPrimaryPreview?: boolean;
  readonly label?: string;
  readonly dimensions?: GeneratedResultDerivativeDimensions;
  readonly access?: GeneratedResultDerivativeProtectedAccess;
  readonly availability: GeneratedResultDerivativeAvailabilityMetadata;
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface GeneratedResultAssetDerivativeCatalog {
  readonly resultAssetId: AssetId;
  readonly resultLogicalAssetVersionId?: string;
  readonly descriptors: ReadonlyArray<GeneratedResultAssetDerivativeDescriptor>;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GeneratedResultAssetDerivativeDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new GeneratedResultAssetDerivativeDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizePresentationRole(
  value: GeneratedResultDerivativePresentationRole,
): GeneratedResultDerivativePresentationRole {
  if (!Object.values(GeneratedResultDerivativePresentationRoles).includes(value)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      `Generated result derivative presentationRole '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function normalizeDerivativeKind(value: GeneratedResultDerivativeKind): GeneratedResultDerivativeKind {
  if (!Object.values(GeneratedResultDerivativeKinds).includes(value)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      `Generated result derivative derivativeKind '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function normalizePreviewKind(value?: GeneratedResultPreviewKind): GeneratedResultPreviewKind | undefined {
  if (!value) {
    return undefined;
  }
  if (!Object.values(GeneratedResultPreviewKinds).includes(value)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      `Generated result derivative previewKind '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function normalizeDerivativeId(value: string): string {
  const normalized = normalizeRequired(value, "Generated result derivative derivativeId").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{2,191}$/.test(normalized)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative derivativeId must be 3-192 lowercase characters and use alphanumeric, '.', '_', ':', or '-'.",
    );
  }
  return normalized;
}

function normalizeDimensions(value?: GeneratedResultDerivativeDimensions): GeneratedResultDerivativeDimensions | undefined {
  if (!value) {
    return undefined;
  }
  if (!Number.isInteger(value.width) || value.width < 1) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative dimensions.width must be an integer >= 1.",
    );
  }
  if (!Number.isInteger(value.height) || value.height < 1) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative dimensions.height must be an integer >= 1.",
    );
  }
  return Object.freeze({
    width: value.width,
    height: value.height,
  });
}

function normalizeMediaType(value: string): string {
  const normalized = normalizeRequired(value, "Generated result derivative access.mediaType").toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative access.mediaType must be a valid media type.",
    );
  }
  return normalized;
}

function assertNotFilesystemPath(value: string, field: string): void {
  if (/^[a-zA-Z]:\\/.test(value) || value.includes("\\") || value.startsWith("/")) {
    throw new GeneratedResultAssetDerivativeDomainError(
      `${field} must be a logical protected-access reference, not a filesystem path.`,
    );
  }
}

function normalizeProtectedAccess(
  value?: GeneratedResultDerivativeProtectedAccess,
): GeneratedResultDerivativeProtectedAccess | undefined {
  if (!value) {
    return undefined;
  }

  const protectedResourceId = normalizeRequired(
    value.protectedResourceId,
    "Generated result derivative access.protectedResourceId",
  );
  const accessHandle = normalizeRequired(value.accessHandle, "Generated result derivative access.accessHandle");

  assertNotFilesystemPath(protectedResourceId, "Generated result derivative access.protectedResourceId");
  assertNotFilesystemPath(accessHandle, "Generated result derivative access.accessHandle");

  if (protectedResourceId.startsWith("storage-instance://") || accessHandle.startsWith("storage-instance://")) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative access descriptors cannot expose storage-instance references.",
    );
  }

  if (!/^protected-resource:\/\/[a-z0-9][a-z0-9._:-]{2,191}$/.test(protectedResourceId)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative access.protectedResourceId must use 'protected-resource://<id>' format.",
    );
  }

  if (!/^preview-access:\/\/[a-z0-9][a-z0-9._:/-]{2,255}$/.test(accessHandle)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative access.accessHandle must use 'preview-access://<scope>/<handle>' format.",
    );
  }

  if (value.byteSize !== undefined && (!Number.isInteger(value.byteSize) || value.byteSize < 1)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative access.byteSize must be an integer >= 1 when provided.",
    );
  }

  return Object.freeze({
    protectedResourceId,
    accessHandle,
    mediaType: normalizeMediaType(value.mediaType),
    byteSize: value.byteSize,
  });
}

function normalizeAvailabilityStatus(
  value: GeneratedResultDerivativeAvailabilityStatus,
): GeneratedResultDerivativeAvailabilityStatus {
  if (!Object.values(GeneratedResultDerivativeAvailabilityStatuses).includes(value)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      `Generated result derivative availability status '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function normalizeAvailability(
  input: GeneratedResultDerivativeAvailabilityMetadata,
): GeneratedResultDerivativeAvailabilityMetadata {
  const status = normalizeAvailabilityStatus(input.status);
  const generationMode = input.generationMode;

  if (!["deferred", "on-demand", "eager"].includes(generationMode)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      `Generated result derivative generationMode '${String(generationMode)}' is invalid.`,
    );
  }

  if (!Number.isInteger(input.generationRevision) || input.generationRevision < 1) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative generationRevision must be an integer >= 1.",
    );
  }

  const normalized = Object.freeze({
    status,
    generationMode,
    generationRevision: input.generationRevision,
    requestedAt: normalizeTimestamp(input.requestedAt, "Generated result derivative availability.requestedAt"),
    requestedBy: normalizeRequired(input.requestedBy, "Generated result derivative availability.requestedBy"),
    generatedAt: input.generatedAt
      ? normalizeTimestamp(input.generatedAt, "Generated result derivative availability.generatedAt")
      : undefined,
    generatedBy: normalizeOptional(input.generatedBy),
    refreshedAt: input.refreshedAt
      ? normalizeTimestamp(input.refreshedAt, "Generated result derivative availability.refreshedAt")
      : undefined,
    refreshedBy: normalizeOptional(input.refreshedBy),
    failedAt: input.failedAt
      ? normalizeTimestamp(input.failedAt, "Generated result derivative availability.failedAt")
      : undefined,
    failedBy: normalizeOptional(input.failedBy),
    failureCode: normalizeOptional(input.failureCode),
    failureMessage: normalizeOptional(input.failureMessage),
    sourceResultVersionId: normalizeOptional(input.sourceResultVersionId),
  });

  if (
    (normalized.generatedAt && !normalized.generatedBy)
    || (!normalized.generatedAt && normalized.generatedBy)
  ) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative availability generatedAt and generatedBy must be provided together.",
    );
  }

  if (
    (normalized.refreshedAt && !normalized.refreshedBy)
    || (!normalized.refreshedAt && normalized.refreshedBy)
  ) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative availability refreshedAt and refreshedBy must be provided together.",
    );
  }

  if (
    (normalized.failedAt && !normalized.failedBy)
    || (!normalized.failedAt && normalized.failedBy)
  ) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative availability failedAt and failedBy must be provided together.",
    );
  }

  if (
    (normalized.failedAt && (!normalized.failureCode || !normalized.failureMessage))
    || (!normalized.failedAt && (normalized.failureCode || normalized.failureMessage))
  ) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative availability failureCode and failureMessage are required when failedAt is provided.",
    );
  }

  if (Date.parse(normalized.requestedAt) > Date.parse(normalized.generatedAt ?? normalized.requestedAt)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative generatedAt cannot be earlier than requestedAt.",
    );
  }

  if (normalized.refreshedAt && normalized.generatedAt && Date.parse(normalized.refreshedAt) < Date.parse(normalized.generatedAt)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative refreshedAt cannot be earlier than generatedAt.",
    );
  }

  if (normalized.failedAt && Date.parse(normalized.failedAt) < Date.parse(normalized.requestedAt)) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Generated result derivative failedAt cannot be earlier than requestedAt.",
    );
  }

  if (status === GeneratedResultDerivativeAvailabilityStatuses.pending) {
    if (
      normalized.generatedAt
      || normalized.generatedBy
      || normalized.refreshedAt
      || normalized.refreshedBy
      || normalized.failedAt
      || normalized.failedBy
      || normalized.failureCode
      || normalized.failureMessage
    ) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Pending generated result derivatives cannot include generated, refreshed, or failed metadata.",
      );
    }
  } else if (status === GeneratedResultDerivativeAvailabilityStatuses.available) {
    if (!normalized.generatedAt || !normalized.generatedBy) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Available generated result derivatives must include generatedAt and generatedBy.",
      );
    }
    if (
      normalized.refreshedAt
      || normalized.refreshedBy
      || normalized.failedAt
      || normalized.failedBy
      || normalized.failureCode
      || normalized.failureMessage
    ) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Available generated result derivatives cannot include refreshed or failed metadata.",
      );
    }
  } else if (status === GeneratedResultDerivativeAvailabilityStatuses.failed) {
    if (!normalized.failedAt || !normalized.failedBy || !normalized.failureCode || !normalized.failureMessage) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Failed generated result derivatives must include failedAt, failedBy, failureCode, and failureMessage.",
      );
    }
    if (
      normalized.generatedAt
      || normalized.generatedBy
      || normalized.refreshedAt
      || normalized.refreshedBy
    ) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Failed generated result derivatives cannot include generated or refreshed metadata.",
      );
    }
  } else {
    if (!normalized.generatedAt || !normalized.generatedBy || !normalized.refreshedAt || !normalized.refreshedBy) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Stale generated result derivatives must include generated and refreshed metadata.",
      );
    }
    if (
      normalized.failedAt
      || normalized.failedBy
      || normalized.failureCode
      || normalized.failureMessage
    ) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Stale generated result derivatives cannot include failed metadata.",
      );
    }
  }

  return normalized;
}

function normalizeAttributes(
  value?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> | undefined {
  if (!value) {
    return undefined;
  }
  const entries = Object.entries(value).map(([key, entryValue]) => [
    normalizeRequired(key, "Generated result derivative attributes key"),
    normalizeRequired(entryValue, "Generated result derivative attributes value"),
  ]);
  return Object.freeze(Object.fromEntries(entries));
}

function assertPreviewRoleInvariants(value: {
  readonly presentationRole: GeneratedResultDerivativePresentationRole;
  readonly derivativeKind: GeneratedResultDerivativeKind;
  readonly previewKind?: GeneratedResultPreviewKind;
  readonly isPrimaryPreview?: boolean;
}): void {
  if (value.presentationRole === GeneratedResultDerivativePresentationRoles.preview) {
    if (!value.previewKind) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Generated result preview derivatives require previewKind.",
      );
    }
    if (value.derivativeKind !== value.previewKind) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Generated result preview derivatives require derivativeKind to match previewKind.",
      );
    }
    return;
  }

  if (value.previewKind) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Non-preview generated result derivatives cannot include previewKind.",
    );
  }

  if (value.isPrimaryPreview) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Only preview derivatives can be marked as primary preview.",
    );
  }
}

function assertAvailabilityAccessInvariants(value: {
  readonly access?: GeneratedResultDerivativeProtectedAccess;
  readonly availability: GeneratedResultDerivativeAvailabilityMetadata;
}): void {
  if (
    value.availability.status === GeneratedResultDerivativeAvailabilityStatuses.pending
    || value.availability.status === GeneratedResultDerivativeAvailabilityStatuses.failed
  ) {
    if (value.access) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Pending or failed generated result derivatives cannot include access descriptors.",
      );
    }
    return;
  }

  if (!value.access) {
    throw new GeneratedResultAssetDerivativeDomainError(
      "Available or stale generated result derivatives must include access descriptors.",
    );
  }
}

function assertDescriptorInvariants(value: GeneratedResultAssetDerivativeDescriptor): void {
  assertPreviewRoleInvariants(value);
  assertAvailabilityAccessInvariants(value);
}

export function rehydrateGeneratedResultAssetDerivativeDescriptor(input: {
  readonly derivativeId: string;
  readonly resultAssetId: string;
  readonly resultLogicalAssetVersionId?: string;
  readonly presentationRole: GeneratedResultDerivativePresentationRole;
  readonly derivativeKind: GeneratedResultDerivativeKind;
  readonly previewKind?: GeneratedResultPreviewKind;
  readonly isPrimaryPreview?: boolean;
  readonly label?: string;
  readonly dimensions?: GeneratedResultDerivativeDimensions;
  readonly access?: GeneratedResultDerivativeProtectedAccess;
  readonly availability: GeneratedResultDerivativeAvailabilityMetadata;
  readonly attributes?: Readonly<Record<string, string>>;
}): GeneratedResultAssetDerivativeDescriptor {
  const descriptor = Object.freeze({
    derivativeId: normalizeDerivativeId(input.derivativeId),
    resultAssetId: createAssetId(input.resultAssetId),
    resultLogicalAssetVersionId: normalizeOptional(input.resultLogicalAssetVersionId),
    presentationRole: normalizePresentationRole(input.presentationRole),
    derivativeKind: normalizeDerivativeKind(input.derivativeKind),
    previewKind: normalizePreviewKind(input.previewKind),
    isPrimaryPreview: input.isPrimaryPreview === true ? true : undefined,
    label: normalizeOptional(input.label),
    dimensions: normalizeDimensions(input.dimensions),
    access: normalizeProtectedAccess(input.access),
    availability: normalizeAvailability(input.availability),
    attributes: normalizeAttributes(input.attributes),
  });

  assertDescriptorInvariants(descriptor);
  return descriptor;
}

export function createPendingGeneratedResultAssetDerivativeDescriptor(input: {
  readonly derivativeId: string;
  readonly resultAssetId: string;
  readonly resultLogicalAssetVersionId?: string;
  readonly presentationRole: GeneratedResultDerivativePresentationRole;
  readonly derivativeKind: GeneratedResultDerivativeKind;
  readonly previewKind?: GeneratedResultPreviewKind;
  readonly isPrimaryPreview?: boolean;
  readonly label?: string;
  readonly dimensions?: GeneratedResultDerivativeDimensions;
  readonly requestedAt?: Date | string;
  readonly requestedBy: string;
  readonly generationMode?: "deferred" | "on-demand" | "eager";
  readonly generationRevision?: number;
  readonly sourceResultVersionId?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}): GeneratedResultAssetDerivativeDescriptor {
  const requestedAt = normalizeTimestamp(
    input.requestedAt ?? new Date(),
    "Generated result derivative availability.requestedAt",
  );

  return rehydrateGeneratedResultAssetDerivativeDescriptor({
    derivativeId: input.derivativeId,
    resultAssetId: input.resultAssetId,
    resultLogicalAssetVersionId: input.resultLogicalAssetVersionId,
    presentationRole: input.presentationRole,
    derivativeKind: input.derivativeKind,
    previewKind: input.previewKind,
    isPrimaryPreview: input.isPrimaryPreview,
    label: input.label,
    dimensions: input.dimensions,
    availability: {
      status: GeneratedResultDerivativeAvailabilityStatuses.pending,
      generationMode: input.generationMode ?? "deferred",
      generationRevision: input.generationRevision ?? 1,
      requestedAt,
      requestedBy: input.requestedBy,
      sourceResultVersionId: input.sourceResultVersionId,
    },
    attributes: input.attributes,
  });
}

export function rehydrateGeneratedResultAssetDerivativeCatalog(input: {
  readonly resultAssetId: string;
  readonly resultLogicalAssetVersionId?: string;
  readonly descriptors: ReadonlyArray<GeneratedResultAssetDerivativeDescriptor>;
  readonly updatedAt: Date | string;
  readonly updatedBy: string;
}): GeneratedResultAssetDerivativeCatalog {
  const resultAssetId = createAssetId(input.resultAssetId);
  const derivativeIds = new Set<string>();

  const descriptors = Object.freeze(input.descriptors.map((entry) => {
    if (entry.resultAssetId !== resultAssetId) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Generated result derivative descriptor resultAssetId must match catalog resultAssetId.",
      );
    }

    if (derivativeIds.has(entry.derivativeId)) {
      throw new GeneratedResultAssetDerivativeDomainError(
        "Generated result derivative catalog cannot include duplicate derivativeId values.",
      );
    }

    derivativeIds.add(entry.derivativeId);
    return entry;
  }));

  return Object.freeze({
    resultAssetId,
    resultLogicalAssetVersionId: normalizeOptional(input.resultLogicalAssetVersionId),
    descriptors,
    updatedAt: normalizeTimestamp(input.updatedAt, "Generated result derivative catalog updatedAt"),
    updatedBy: normalizeRequired(input.updatedBy, "Generated result derivative catalog updatedBy"),
  });
}
