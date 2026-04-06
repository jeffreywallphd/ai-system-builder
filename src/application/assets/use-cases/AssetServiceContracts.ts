import type {
  Asset,
  AssetKind,
  AssetLifecycleState,
  AssetContentEncryptionDescriptor,
  AssetSharingPolicyReference,
  AssetStorageArea,
  AssetVisibility,
} from "../../../domain/assets/AssetDomain";

export class AssetServiceContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetServiceContractError";
  }
}

export const AssetServiceErrorCodes = Object.freeze({
  invalidRequest: "asset-invalid-request",
  accessDenied: "asset-access-denied",
  notFound: "asset-not-found",
  conflict: "asset-conflict",
  invalidState: "asset-invalid-state",
  policyViolation: "asset-policy-violation",
  contentUnavailable: "asset-content-unavailable",
  internal: "asset-internal",
});

export type AssetServiceErrorCode = typeof AssetServiceErrorCodes[keyof typeof AssetServiceErrorCodes];

export interface AssetServiceError {
  readonly code: AssetServiceErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type AssetServiceResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: AssetServiceError;
  };

export interface AssetRequestContext {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface AssetMutationContext extends AssetRequestContext {
  readonly operationKey: string;
}

export interface AssetVersionCreationInput {
  readonly versionId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
  readonly content: {
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly checksum: {
      readonly algorithm: "sha256" | "sha512" | "md5";
      readonly digest: string;
    };
    readonly originalFileName?: string;
    readonly encryption?: AssetContentEncryptionDescriptor;
  };
}

export interface RegisterAssetRequest extends AssetMutationContext {
  readonly assetId: string;
  readonly kind: AssetKind;
  readonly ownerUserId?: string;
  readonly visibility?: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly storageInstanceId: string;
  readonly initialVersion: AssetVersionCreationInput;
}

export interface BeginAssetUploadRequest extends AssetMutationContext {
  readonly assetId: string;
  readonly storageInstanceId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly area?: AssetStorageArea;
  readonly expiresInSeconds?: number;
}

const MaxDeclaredAssetContentBytes = 10 * 1024 * 1024 * 1024;
const MaxMimeTypeLength = 255;

export interface GetAssetByIdQuery extends AssetRequestContext {
  readonly assetId: string;
  readonly includeDeleted?: boolean;
}

export interface AssetDetailActionSet {
  readonly canInitiateUpload: boolean;
  readonly canAuthorizeDownload: boolean;
  readonly canResolvePreview: boolean;
  readonly canArchive: boolean;
  readonly canDelete: boolean;
}

export interface AssetLineageHook {
  readonly sourceAssetId: string;
  readonly sourceAssetVersionId?: string;
  readonly relation?: string;
}

export interface GeneratedOutputSourceReference {
  readonly producerType: "run" | "system";
  readonly runId?: string;
  readonly systemId?: string;
}

export interface AssetDetailMetadata {
  readonly isOwnedByActor: boolean;
  readonly uploadState: "ready" | "archived" | "deleted";
  readonly previewAvailable: boolean;
  readonly previewMimeTypeHint?: string;
  readonly allowedActions: AssetDetailActionSet;
  readonly links: {
    readonly self: string;
    readonly list: string;
    readonly initiateUpload: string;
    readonly authorizeDownload: string;
    readonly resolvePreview: string;
    readonly listGeneratedOutputsBySource: string;
  };
  readonly lineage: {
    readonly sources: ReadonlyArray<AssetLineageHook>;
  };
  readonly generatedOutputSource?: GeneratedOutputSourceReference;
}

export interface ListAssetsQuery extends AssetRequestContext {
  readonly scope?: "private" | "workspace" | "all";
  readonly ownerUserId?: string;
  readonly createdByUserId?: string;
  readonly storageInstanceId?: string;
  readonly assetKinds?: ReadonlyArray<AssetKind>;
  readonly visibilities?: ReadonlyArray<AssetVisibility>;
  readonly lifecycleStates?: ReadonlyArray<AssetLifecycleState>;
  readonly sourceAssetId?: string;
  readonly sourceAssetVersionId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface FinalizeAssetUploadRequest extends AssetMutationContext {
  readonly assetId: string;
  readonly uploadSessionId: string;
  readonly version: AssetVersionCreationInput;
  readonly setAsCurrentVersion?: boolean;
}

export const AssetDownloadPurposes = Object.freeze({
  download: "download",
  inlinePreview: "inline-preview",
  workerProcess: "worker-process",
});

export type AssetDownloadPurpose = typeof AssetDownloadPurposes[keyof typeof AssetDownloadPurposes];

export interface AuthorizeAssetDownloadRequest extends AssetRequestContext {
  readonly assetId: string;
  readonly versionId?: string;
  readonly purpose: AssetDownloadPurpose;
  readonly fileNameHint?: string;
  readonly expiresInSeconds?: number;
}

export interface OpenAuthorizedAssetDownloadStreamRequest extends AssetRequestContext {
  readonly assetId: string;
  readonly contentToken: string;
}

export interface ResolveAssetPreviewQuery extends AssetRequestContext {
  readonly assetId: string;
  readonly versionId?: string;
  readonly preferredMimeTypes?: ReadonlyArray<string>;
}

export interface RegisterGeneratedOutputRequest extends AssetMutationContext {
  readonly assetId: string;
  readonly ownerUserId?: string;
  readonly visibility?: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly storageInstanceId: string;
  readonly outputVersion: AssetVersionCreationInput;
  readonly source: GeneratedOutputSourceReference;
  readonly lineage: ReadonlyArray<{
    readonly sourceAssetId: string;
    readonly sourceAssetVersionId?: string;
    readonly relation?: string;
  }>;
}

export interface ArchiveAssetRequest extends AssetMutationContext {
  readonly assetId: string;
}

export interface DeleteAssetRequest extends AssetMutationContext {
  readonly assetId: string;
}

export interface AssetDownloadAuthorization {
  readonly assetId: string;
  readonly versionId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentToken: string;
  readonly expiresAt: string;
  readonly contentDispositionFileName?: string;
}

export interface OpenAuthorizedAssetDownloadStreamResult {
  readonly assetId: string;
  readonly versionId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment" | "inline";
  readonly contentDispositionFileName?: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface AssetPreviewResolution {
  readonly assetId: string;
  readonly versionId: string;
  readonly previewAssetId?: string;
  readonly previewVersionId?: string;
  readonly previewMimeType?: string;
  readonly previewStorageInstanceId?: string;
  readonly previewObjectKey?: string;
}

export interface RegisterAssetResult {
  readonly asset: Asset;
}

export interface GetAssetByIdResult {
  readonly asset: Asset;
  readonly metadata: AssetDetailMetadata;
}

export interface ListAssetsResult {
  readonly items: ReadonlyArray<Asset>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface FinalizeAssetUploadResult {
  readonly asset: Asset;
  readonly finalizedVersionId: string;
}

export interface RegisterGeneratedOutputResult {
  readonly asset: Asset;
}

export interface BeginAssetUploadResult {
  readonly asset: Asset;
  readonly upload: {
    readonly uploadSessionId: string;
    readonly assetId: string;
    readonly workspaceId: string;
    readonly storageInstanceId: string;
    readonly objectKey: string;
    readonly area: AssetStorageArea;
    readonly uploadEndpoint: string;
    readonly uploadMethod: "POST";
    readonly expected: {
      readonly fileName: string;
      readonly mimeType: string;
      readonly sizeBytes: number;
    };
    readonly expiresAt: string;
  };
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AssetServiceContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AssetServiceContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizePositiveInteger(
  value: number | undefined,
  field: string,
  minimum: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < minimum) {
    throw new AssetServiceContractError(`${field} must be an integer >= ${String(minimum)}.`);
  }
  return value;
}

function normalizeRequiredInteger(value: number, field: string, minimum: number): number {
  if (!Number.isInteger(value) || value < minimum) {
    throw new AssetServiceContractError(`${field} must be an integer >= ${String(minimum)}.`);
  }
  return value;
}

function normalizeBoundedRequiredInteger(
  value: number,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const normalized = normalizeRequiredInteger(value, field, minimum);
  if (normalized > maximum) {
    throw new AssetServiceContractError(`${field} must be <= ${String(maximum)}.`);
  }
  return normalized;
}

function normalizeFileName(value: string): string {
  const normalized = normalizeRequired(value, "fileName");
  if (normalized.length > 255) {
    throw new AssetServiceContractError("fileName must be 255 characters or fewer.");
  }
  if (normalized.includes("/") || normalized.includes("\\")) {
    throw new AssetServiceContractError("fileName cannot include path separators.");
  }
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new AssetServiceContractError("fileName cannot include control characters.");
  }
  if (normalized === "." || normalized === "..") {
    throw new AssetServiceContractError("fileName cannot be '.' or '..'.");
  }
  return normalized;
}

function normalizeObjectKey(value: string): string {
  const normalized = normalizeRequired(value, "Asset objectKey");
  if (normalized.startsWith("/")) {
    throw new AssetServiceContractError("Asset objectKey cannot be an absolute path.");
  }
  if (normalized.includes("\\")) {
    throw new AssetServiceContractError("Asset objectKey cannot use Windows path separators.");
  }
  if (/^[a-zA-Z]:\//.test(normalized)) {
    throw new AssetServiceContractError("Asset objectKey cannot use drive-letter prefixes.");
  }
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new AssetServiceContractError("Asset objectKey contains invalid traversal segments.");
  }
  return normalized;
}

function normalizeMimeTypeValue(value: string, field: string): string {
  const normalized = normalizeRequired(value, field).toLowerCase();
  if (normalized.length > MaxMimeTypeLength) {
    throw new AssetServiceContractError(`${field} must be ${String(MaxMimeTypeLength)} characters or fewer.`);
  }
  const mediaType = normalized.split(";")[0]?.trim();
  if (!mediaType) {
    throw new AssetServiceContractError(`${field} must be a valid media type.`);
  }
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mediaType)) {
    throw new AssetServiceContractError(`${field} must be a valid media type.`);
  }
  return mediaType;
}

function normalizeAssetVersionCreationInput(input: AssetVersionCreationInput): AssetVersionCreationInput {
  return Object.freeze({
    versionId: normalizeRequired(input.versionId, "Asset versionId"),
    storageInstanceId: normalizeRequired(input.storageInstanceId, "Asset storageInstanceId"),
    objectKey: normalizeObjectKey(input.objectKey),
    objectVersionId: normalizeOptional(input.objectVersionId),
    area: input.area,
    content: Object.freeze({
      mimeType: normalizeMimeTypeValue(input.content.mimeType, "Asset content mimeType"),
      sizeBytes: normalizeBoundedRequiredInteger(
        input.content.sizeBytes,
        "Asset content sizeBytes",
        0,
        MaxDeclaredAssetContentBytes,
      ),
      checksum: Object.freeze({
        algorithm: input.content.checksum.algorithm,
        digest: normalizeRequired(input.content.checksum.digest, "Asset content checksum digest").toLowerCase(),
      }),
      originalFileName: normalizeOptional(input.content.originalFileName),
      encryption: input.content.encryption,
    }),
  });
}

function normalizeGeneratedOutputSourceReference(
  source: GeneratedOutputSourceReference,
): GeneratedOutputSourceReference {
  const producerType = source.producerType;
  if (producerType !== "run" && producerType !== "system") {
    throw new AssetServiceContractError("source.producerType must be either 'run' or 'system'.");
  }

  if (producerType === "run") {
    const runId = normalizeRequired(source.runId ?? "", "source.runId");
    const systemId = normalizeOptional(source.systemId);
    return Object.freeze({
      producerType,
      runId,
      systemId,
    });
  }

  const systemId = normalizeRequired(source.systemId ?? "", "source.systemId");
  const runId = normalizeOptional(source.runId);
  return Object.freeze({
    producerType,
    systemId,
    runId,
  });
}

function normalizeRequestContext<TValue extends AssetRequestContext>(value: TValue): TValue {
  return Object.freeze({
    ...value,
    actorUserId: normalizeRequired(value.actorUserId, "actorUserId"),
    workspaceId: normalizeRequired(value.workspaceId, "workspaceId"),
    correlationId: normalizeOptional(value.correlationId),
    occurredAt: normalizeTimestamp(value.occurredAt, "occurredAt"),
  }) as TValue;
}

function normalizeMutationContext<TValue extends AssetMutationContext>(value: TValue): TValue {
  const normalizedContext = normalizeRequestContext(value);
  return Object.freeze({
    ...normalizedContext,
    operationKey: normalizeRequired(value.operationKey, "operationKey"),
  }) as TValue;
}

export function validateRegisterAssetRequest(input: RegisterAssetRequest): RegisterAssetRequest {
  const normalized = normalizeMutationContext(input);
  const ownerUserId = normalizeOptional(input.ownerUserId);
  const visibility = input.visibility ?? (ownerUserId ? "private" : "workspace");
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    ownerUserId,
    visibility,
    storageInstanceId: normalizeRequired(input.storageInstanceId, "storageInstanceId"),
    sharingPolicyRef: input.sharingPolicyRef
      ? Object.freeze({
        policyId: normalizeRequired(input.sharingPolicyRef.policyId, "sharingPolicyRef.policyId"),
        policyVersion: normalizeOptional(input.sharingPolicyRef.policyVersion),
      })
      : undefined,
    initialVersion: normalizeAssetVersionCreationInput(input.initialVersion),
  });
}

export function validateListAssetsQuery(input: ListAssetsQuery): ListAssetsQuery {
  const normalized = normalizeRequestContext(input);
  const scope = normalizeOptional(input.scope) as ListAssetsQuery["scope"];
  if (scope && scope !== "private" && scope !== "workspace" && scope !== "all") {
    throw new AssetServiceContractError("scope must be one of: private, workspace, all.");
  }
  return Object.freeze({
    ...normalized,
    scope,
    ownerUserId: normalizeOptional(input.ownerUserId),
    createdByUserId: normalizeOptional(input.createdByUserId),
    storageInstanceId: normalizeOptional(input.storageInstanceId),
    sourceAssetId: normalizeOptional(input.sourceAssetId),
    sourceAssetVersionId: normalizeOptional(input.sourceAssetVersionId),
    limit: normalizePositiveInteger(input.limit, "limit", 1),
    offset: normalizePositiveInteger(input.offset, "offset", 0),
  });
}

export function validateGetAssetByIdQuery(input: GetAssetByIdQuery): GetAssetByIdQuery {
  const normalized = normalizeRequestContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    includeDeleted: input.includeDeleted ?? false,
  });
}

export function validateFinalizeAssetUploadRequest(
  input: FinalizeAssetUploadRequest,
): FinalizeAssetUploadRequest {
  const normalized = normalizeMutationContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    uploadSessionId: normalizeRequired(input.uploadSessionId, "uploadSessionId"),
    version: normalizeAssetVersionCreationInput(input.version),
    setAsCurrentVersion: input.setAsCurrentVersion ?? true,
  });
}

export function validateAuthorizeAssetDownloadRequest(
  input: AuthorizeAssetDownloadRequest,
): AuthorizeAssetDownloadRequest {
  const normalized = normalizeRequestContext(input);
  const expiresInSeconds = normalizePositiveInteger(input.expiresInSeconds, "expiresInSeconds", 1);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    versionId: normalizeOptional(input.versionId),
    purpose: input.purpose,
    fileNameHint: input.fileNameHint !== undefined ? normalizeFileName(input.fileNameHint) : undefined,
    expiresInSeconds,
  });
}

export function validateOpenAuthorizedAssetDownloadStreamRequest(
  input: OpenAuthorizedAssetDownloadStreamRequest,
): OpenAuthorizedAssetDownloadStreamRequest {
  const normalized = normalizeRequestContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    contentToken: normalizeRequired(input.contentToken, "contentToken"),
  });
}

export function validateResolveAssetPreviewQuery(input: ResolveAssetPreviewQuery): ResolveAssetPreviewQuery {
  const normalized = normalizeRequestContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    versionId: normalizeOptional(input.versionId),
    preferredMimeTypes: input.preferredMimeTypes
      ? Object.freeze(
        input.preferredMimeTypes
          .map((value) => normalizeRequired(value, "preferredMimeTypes[]").toLowerCase()),
      )
      : undefined,
  });
}

export function validateRegisterGeneratedOutputRequest(
  input: RegisterGeneratedOutputRequest,
): RegisterGeneratedOutputRequest {
  const normalized = normalizeMutationContext(input);
  const ownerUserId = normalizeOptional(input.ownerUserId);
  const visibility = input.visibility ?? (ownerUserId ? "private" : "workspace");
  const lineageInput = Array.isArray(input.lineage) ? input.lineage : [];
  const lineage = Object.freeze(
    lineageInput.map((entry) => Object.freeze({
      sourceAssetId: normalizeRequired(entry.sourceAssetId, "lineage.sourceAssetId"),
      sourceAssetVersionId: normalizeOptional(entry.sourceAssetVersionId),
      relation: normalizeOptional(entry.relation),
    })),
  );
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    ownerUserId,
    visibility,
    sharingPolicyRef: input.sharingPolicyRef
      ? Object.freeze({
        policyId: normalizeRequired(input.sharingPolicyRef.policyId, "sharingPolicyRef.policyId"),
        policyVersion: normalizeOptional(input.sharingPolicyRef.policyVersion),
      })
      : undefined,
    storageInstanceId: normalizeRequired(input.storageInstanceId, "storageInstanceId"),
    outputVersion: normalizeAssetVersionCreationInput(input.outputVersion),
    source: normalizeGeneratedOutputSourceReference(input.source),
    lineage,
  });
}

export function validateArchiveAssetRequest(input: ArchiveAssetRequest): ArchiveAssetRequest {
  const normalized = normalizeMutationContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
  });
}

export function validateDeleteAssetRequest(input: DeleteAssetRequest): DeleteAssetRequest {
  const normalized = normalizeMutationContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
  });
}

export function validateBeginAssetUploadRequest(input: BeginAssetUploadRequest): BeginAssetUploadRequest {
  const normalized = normalizeMutationContext(input);
  return Object.freeze({
    ...normalized,
    assetId: normalizeRequired(input.assetId, "assetId"),
    storageInstanceId: normalizeRequired(input.storageInstanceId, "storageInstanceId"),
    fileName: normalizeFileName(input.fileName),
    mimeType: normalizeMimeTypeValue(input.mimeType, "mimeType"),
    sizeBytes: normalizeBoundedRequiredInteger(input.sizeBytes, "sizeBytes", 0, MaxDeclaredAssetContentBytes),
    area: input.area ?? "input",
    expiresInSeconds: normalizePositiveInteger(input.expiresInSeconds, "expiresInSeconds", 1),
  });
}

export interface AssetLookupUseCaseContracts {
  getAssetById(query: GetAssetByIdQuery): Promise<AssetServiceResult<GetAssetByIdResult>>;
  listAssets(query: ListAssetsQuery): Promise<AssetServiceResult<ListAssetsResult>>;
  authorizeAssetDownload(
    request: AuthorizeAssetDownloadRequest,
  ): Promise<AssetServiceResult<AssetDownloadAuthorization>>;
  openAuthorizedAssetDownloadStream(
    request: OpenAuthorizedAssetDownloadStreamRequest,
  ): Promise<AssetServiceResult<OpenAuthorizedAssetDownloadStreamResult>>;
  resolveAssetPreview(
    query: ResolveAssetPreviewQuery,
  ): Promise<AssetServiceResult<AssetPreviewResolution>>;
}

export interface AssetMutationUseCaseContracts {
  registerAsset(request: RegisterAssetRequest): Promise<AssetServiceResult<RegisterAssetResult>>;
  beginAssetUpload(request: BeginAssetUploadRequest): Promise<AssetServiceResult<BeginAssetUploadResult>>;
  finalizeAssetUpload(
    request: FinalizeAssetUploadRequest,
  ): Promise<AssetServiceResult<FinalizeAssetUploadResult>>;
  registerGeneratedOutput(
    request: RegisterGeneratedOutputRequest,
  ): Promise<AssetServiceResult<RegisterGeneratedOutputResult>>;
  archiveAsset(request: ArchiveAssetRequest): Promise<AssetServiceResult<RegisterAssetResult>>;
  deleteAsset(request: DeleteAssetRequest): Promise<AssetServiceResult<RegisterAssetResult>>;
}

export interface IAssetManagementService extends AssetLookupUseCaseContracts, AssetMutationUseCaseContracts {}
