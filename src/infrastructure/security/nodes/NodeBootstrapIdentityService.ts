import { access, chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import path from "node:path";
import {
  NodeApprovalStatuses,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
  type NodeCapabilityProfile,
  type NodeRoleCapability,
  type NodeType,
} from "@domain/nodes/NodeTrustDomain";
import type { NodeEnrollmentSubmissionRequestDto } from "@shared/contracts/nodes/NodeTrustApiContracts";

const BOOTSTRAP_RECORD_FILE_NAME = "node-bootstrap-record.json";
const PRIVATE_KEY_FILE_NAME = "node-bootstrap-private-key.pem";
const PUBLIC_KEY_FILE_NAME = "node-bootstrap-public-key.pem";
const BOOTSTRAP_RECORD_SCHEMA_VERSION = 1;

export class NodeBootstrapIdentityServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeBootstrapIdentityServiceError";
  }
}

export interface NodeBootstrapIdentityRecord {
  readonly schemaVersion: number;
  readonly nodeId: string;
  readonly nodeType: typeof NodeTypes.compute | typeof NodeTypes.hybrid;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly publicTrustMaterialRef: string;
  readonly publicKeyAlgorithm: "ed25519";
  readonly publicKeyFingerprintSha256: string;
  readonly approvalStatus: typeof NodeApprovalStatuses.pending;
  readonly trustState: typeof NodeTrustStates.pendingEnrollment;
  readonly createdAt: string;
}

export interface NodeBootstrapIdentityMaterial {
  readonly record: NodeBootstrapIdentityRecord;
  readonly publicKeyPem: string;
  readonly privateKeyPemPath: string;
  readonly publicKeyPemPath: string;
}

export interface EnsureNodeBootstrapIdentityRequest {
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: {
    readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
    readonly capabilityProfileVersion?: string;
    readonly supportsRemoteScheduling?: boolean;
    readonly maxConcurrentWorkloads?: number;
  };
  readonly deploymentTags?: ReadonlyArray<string>;
}

export interface NodeBootstrapEnrollmentPayloadOptions {
  readonly actorUserIdentityId?: string;
  readonly requestedCertificateProfile?: string;
  readonly bootstrapTokenId?: string;
  readonly bootstrapNonce?: string;
  readonly attestationFormat?: string;
  readonly attestationEvidence?: string;
  readonly requestedAt?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface NodeBootstrapPersistedRecord {
  readonly record: NodeBootstrapIdentityRecord;
}

export class NodeBootstrapIdentityService {
  private readonly bootstrapRecordPath: string;

  private readonly privateKeyPath: string;

  private readonly publicKeyPath: string;

  public constructor(private readonly bootstrapDirectory: string) {
    this.bootstrapRecordPath = path.join(bootstrapDirectory, BOOTSTRAP_RECORD_FILE_NAME);
    this.privateKeyPath = path.join(bootstrapDirectory, PRIVATE_KEY_FILE_NAME);
    this.publicKeyPath = path.join(bootstrapDirectory, PUBLIC_KEY_FILE_NAME);
  }

  public async ensureBootstrapIdentity(
    request: EnsureNodeBootstrapIdentityRequest,
  ): Promise<{ readonly created: boolean; readonly material: NodeBootstrapIdentityMaterial }> {
    const existing = await this.tryLoadExistingMaterial();
    if (existing) {
      return Object.freeze({
        created: false,
        material: existing,
      });
    }

    const nodeType = normalizeBootstrapNodeType(request.nodeType);
    const displayName = normalizeDisplayName(request.displayName);
    const capabilityProfile = createNodeCapabilityProfile(request.capabilityProfile);
    const deploymentTags = normalizeDeploymentTags(request.deploymentTags);
    const createdAt = new Date().toISOString();

    const keyPair = generateKeyPairSync("ed25519");
    const privateKeyPem = keyPair.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }).toString();
    const publicKeyPem = keyPair.publicKey.export({
      format: "pem",
      type: "spki",
    }).toString();
    const publicKeyFingerprintSha256 = calculatePublicKeyFingerprint(publicKeyPem);

    const record: NodeBootstrapIdentityRecord = Object.freeze({
      schemaVersion: BOOTSTRAP_RECORD_SCHEMA_VERSION,
      nodeId: `node:${nodeType}:${randomUUID()}`,
      nodeType,
      displayName,
      capabilityProfile,
      deploymentTags,
      publicTrustMaterialRef: `node-public-key:spki-sha256:${publicKeyFingerprintSha256}`,
      publicKeyAlgorithm: "ed25519",
      publicKeyFingerprintSha256,
      approvalStatus: NodeApprovalStatuses.pending,
      trustState: NodeTrustStates.pendingEnrollment,
      createdAt,
    });

    await mkdir(this.bootstrapDirectory, { recursive: true });
    await this.atomicWriteFile(this.privateKeyPath, privateKeyPem);
    await this.atomicWriteFile(this.publicKeyPath, publicKeyPem);
    await this.atomicWriteFile(
      this.bootstrapRecordPath,
      `${JSON.stringify({ record }, null, 2)}\n`,
    );

    return Object.freeze({
      created: true,
      material: Object.freeze({
        record,
        publicKeyPem,
        privateKeyPemPath: this.privateKeyPath,
        publicKeyPemPath: this.publicKeyPath,
      }),
    });
  }

  public buildEnrollmentSubmissionPayload(
    material: NodeBootstrapIdentityMaterial,
    options: NodeBootstrapEnrollmentPayloadOptions = {},
  ): NodeEnrollmentSubmissionRequestDto {
    return Object.freeze({
      actorUserIdentityId: normalizeOptional(options.actorUserIdentityId) ?? material.record.nodeId,
      nodeId: material.record.nodeId,
      nodeType: material.record.nodeType,
      displayName: material.record.displayName,
      capabilityProfile: material.record.capabilityProfile,
      deploymentTags: material.record.deploymentTags,
      bootstrap: Object.freeze({
        bootstrapTokenId: normalizeOptional(options.bootstrapTokenId),
        bootstrapNonce: normalizeOptional(options.bootstrapNonce),
        attestationFormat: normalizeOptional(options.attestationFormat),
        attestationEvidence: normalizeOptional(options.attestationEvidence),
        requestedCertificateProfile: normalizeOptional(options.requestedCertificateProfile),
        trustMaterialRef: material.record.publicTrustMaterialRef,
        publicKeyAlgorithm: material.record.publicKeyAlgorithm,
        publicKeyFingerprintSha256: material.record.publicKeyFingerprintSha256,
        publicKeyPem: material.publicKeyPem,
      }),
      requestedAt: normalizeOptional(options.requestedAt),
      correlationId: normalizeOptional(options.correlationId),
      metadata: options.metadata,
    });
  }

  private async tryLoadExistingMaterial(): Promise<NodeBootstrapIdentityMaterial | undefined> {
    const recordExists = await exists(this.bootstrapRecordPath);
    const privateKeyExists = await exists(this.privateKeyPath);
    const publicKeyExists = await exists(this.publicKeyPath);

    if (!recordExists && !privateKeyExists && !publicKeyExists) {
      return undefined;
    }

    if (!recordExists || !privateKeyExists || !publicKeyExists) {
      throw new NodeBootstrapIdentityServiceError(
        "Node bootstrap material is partially present. Delete and re-bootstrap or restore all bootstrap files.",
      );
    }

    const recordContent = await readFile(this.bootstrapRecordPath, "utf8");
    let persisted: NodeBootstrapPersistedRecord;
    try {
      persisted = JSON.parse(recordContent) as NodeBootstrapPersistedRecord;
    } catch {
      throw new NodeBootstrapIdentityServiceError(
        "Node bootstrap record is unreadable JSON.",
      );
    }

    const record = validatePersistedRecord(persisted.record);
    const publicKeyPem = await readFile(this.publicKeyPath, "utf8");
    const actualFingerprint = calculatePublicKeyFingerprint(publicKeyPem);
    if (record.publicKeyFingerprintSha256 !== actualFingerprint) {
      throw new NodeBootstrapIdentityServiceError(
        "Node bootstrap public key fingerprint does not match the persisted bootstrap record.",
      );
    }

    return Object.freeze({
      record,
      publicKeyPem,
      privateKeyPemPath: this.privateKeyPath,
      publicKeyPemPath: this.publicKeyPath,
    });
  }

  private async atomicWriteFile(destinationPath: string, content: string): Promise<void> {
    const tempPath = `${destinationPath}.tmp-${randomUUID()}`;
    await writeFile(tempPath, content, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, destinationPath);
    await applySecurePermissionsBestEffort(destinationPath);
  }
}

function normalizeDisplayName(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap displayName is required.");
  }
  if (normalized.length > 120) {
    throw new NodeBootstrapIdentityServiceError(
      "Node bootstrap displayName must be 120 characters or fewer.",
    );
  }
  return normalized;
}

function normalizeDeploymentTags(value?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const entry of value ?? []) {
    const normalized = entry.trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeBootstrapNodeType(
  value: NodeType,
): typeof NodeTypes.compute | typeof NodeTypes.hybrid {
  if (value !== NodeTypes.compute && value !== NodeTypes.hybrid) {
    throw new NodeBootstrapIdentityServiceError(
      `Node bootstrap only supports '${NodeTypes.compute}' or '${NodeTypes.hybrid}' node types.`,
    );
  }
  return value;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function validatePersistedRecord(value: unknown): NodeBootstrapIdentityRecord {
  if (!value || typeof value !== "object") {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record payload is invalid.");
  }

  const record = value as Partial<NodeBootstrapIdentityRecord>;
  if (record.schemaVersion !== BOOTSTRAP_RECORD_SCHEMA_VERSION) {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record schemaVersion is unsupported.");
  }
  if (
    record.nodeType !== NodeTypes.compute
    && record.nodeType !== NodeTypes.hybrid
  ) {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record nodeType is invalid.");
  }
  if (
    record.approvalStatus !== NodeApprovalStatuses.pending
    || record.trustState !== NodeTrustStates.pendingEnrollment
  ) {
    throw new NodeBootstrapIdentityServiceError(
      "Node bootstrap record must remain untrusted and pending enrollment.",
    );
  }
  if (!record.nodeId || !record.displayName || !record.publicTrustMaterialRef || !record.publicKeyFingerprintSha256) {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record is missing required fields.");
  }
  if (record.publicKeyAlgorithm && record.publicKeyAlgorithm !== "ed25519") {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record publicKeyAlgorithm is invalid.");
  }
  const createdAt = normalizeIsoTimestamp(record.createdAt);
  if (!createdAt) {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record createdAt is invalid.");
  }

  let capabilityProfile: NodeCapabilityProfile;
  try {
    capabilityProfile = createNodeCapabilityProfile(record.capabilityProfile ?? { enabledCapabilities: [] });
  } catch {
    throw new NodeBootstrapIdentityServiceError("Node bootstrap record capabilityProfile is invalid.");
  }

  return Object.freeze({
    schemaVersion: record.schemaVersion,
    nodeId: record.nodeId,
    nodeType: record.nodeType,
    displayName: record.displayName,
    capabilityProfile,
    deploymentTags: normalizeDeploymentTags(record.deploymentTags),
    publicTrustMaterialRef: record.publicTrustMaterialRef,
    publicKeyAlgorithm: "ed25519",
    publicKeyFingerprintSha256: record.publicKeyFingerprintSha256,
    approvalStatus: record.approvalStatus,
    trustState: record.trustState,
    createdAt,
  });
}

function calculatePublicKeyFingerprint(publicKeyPem: string): string {
  const derEncoded = createPublicKey(publicKeyPem).export({
    format: "der",
    type: "spki",
  });
  return createHash("sha256").update(derEncoded).digest("hex");
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function applySecurePermissionsBestEffort(targetPath: string): Promise<void> {
  try {
    await chmod(targetPath, 0o600);
  } catch {
    // Best effort on platforms without chmod semantics.
  }
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

