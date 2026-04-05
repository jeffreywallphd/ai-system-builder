import { z } from "zod";
import {
  CertificateAuthorityStatuses,
  CertificateRevocationReasons,
  CertificateStatuses,
  CertificateSubjectReferenceKinds,
  CertificateUsageKinds,
  TrustMaterialKinds,
  createCertificateSubjectDescriptor,
  createCertificateValidityWindow,
} from "../../../domain/security/CertificateAuthorityDomain";
import {
  CertificateAuthorityIntrospectionDiagnosticSeverities,
  CertificateAuthorityIntrospectionStates,
  CertificateDistributionEventStatuses,
  CertificateDistributionTargetKinds,
} from "../../dto/security/CertificateAuthorityDtos";

export interface CertificateAuthoritySchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class CertificateAuthoritySchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<CertificateAuthoritySchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<CertificateAuthoritySchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "CertificateAuthoritySchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/;
const SerialPattern = /^[0-9A-F]{2,64}$/;

export const CertificateAuthorityIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(256, "Identifier must be 256 characters or fewer.")
  .regex(IdentifierPattern, "Identifier must use alphanumeric, ':', '_' or '-' characters.");

export const CertificateAuthorityTimestampSchema = z
  .string()
  .trim()
  .min(1, "Timestamp is required.")
  .datetime({ offset: true });

const CertificateAuthorityStatusSchema = z.enum([
  CertificateAuthorityStatuses.active,
  CertificateAuthorityStatuses.retired,
  CertificateAuthorityStatuses.compromised,
]);

const CertificateStatusSchema = z.enum([
  CertificateStatuses.issued,
  CertificateStatuses.revoked,
  CertificateStatuses.expired,
  CertificateStatuses.superseded,
]);

const CertificateUsageKindSchema = z.enum([
  CertificateUsageKinds.serverAuth,
  CertificateUsageKinds.clientAuth,
  CertificateUsageKinds.mutualTls,
  CertificateUsageKinds.nodeEnrollment,
  CertificateUsageKinds.deviceTrust,
  CertificateUsageKinds.serviceIdentity,
]);

const CertificateSubjectReferenceKindSchema = z.enum([
  CertificateSubjectReferenceKinds.node,
  CertificateSubjectReferenceKinds.device,
  CertificateSubjectReferenceKinds.service,
]);

const TrustMaterialKindSchema = z.enum([
  TrustMaterialKinds.certificatePem,
  TrustMaterialKinds.certificateChainPem,
  TrustMaterialKinds.privateKeyEncryptedPem,
  TrustMaterialKinds.crlPem,
]);

export const RotationPolicyMetadataPersistenceRecordSchema = z.object({
  profileId: CertificateAuthorityIdentifierSchema,
  autoRotateEnabled: z.boolean(),
  rotateBeforeExpiryDays: z.number().int().min(1),
  overlapDays: z.number().int().min(0),
  maxLifetimeDays: z.number().int().min(1),
  lastRotatedAt: CertificateAuthorityTimestampSchema.optional(),
  nextRotationDueAt: CertificateAuthorityTimestampSchema.optional(),
});

export const CertificateValidityWindowPersistenceRecordSchema = z.object({
  notBefore: CertificateAuthorityTimestampSchema,
  notAfter: CertificateAuthorityTimestampSchema,
}).superRefine((value, context) => {
  try {
    createCertificateValidityWindow(value);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notAfter"],
      message: error instanceof Error ? error.message : "Invalid certificate validity window.",
    });
  }
});

export const CertificateSubjectPersistenceRecordSchema = z.object({
  commonName: z.string().trim().min(1).max(255),
  organization: z.string().trim().min(1).max(255).optional(),
  organizationalUnit: z.string().trim().min(1).max(255).optional(),
  country: z.string().trim().length(2).optional(),
  stateOrProvince: z.string().trim().min(1).max(255).optional(),
  locality: z.string().trim().min(1).max(255).optional(),
  dnsNames: z.array(z.string().trim().min(1).max(255)),
  ipAddresses: z.array(z.string().trim().min(1).max(255)),
  uriSanEntries: z.array(z.string().trim().min(1).max(512)),
}).superRefine((value, context) => {
  try {
    createCertificateSubjectDescriptor(value);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["commonName"],
      message: error instanceof Error ? error.message : "Invalid certificate subject descriptor.",
    });
  }
});

export const CertificateSubjectReferencePersistenceRecordSchema = z.object({
  kind: CertificateSubjectReferenceKindSchema,
  referenceId: CertificateAuthorityIdentifierSchema,
  workspaceId: CertificateAuthorityIdentifierSchema.optional(),
});

export const CertificateRevocationPersistenceRecordSchema = z.object({
  reason: z.enum([
    CertificateRevocationReasons.unspecified,
    CertificateRevocationReasons.keyCompromise,
    CertificateRevocationReasons.caCompromise,
    CertificateRevocationReasons.affiliationChanged,
    CertificateRevocationReasons.superseded,
    CertificateRevocationReasons.cessationOfOperation,
    CertificateRevocationReasons.privilegeWithdrawn,
    CertificateRevocationReasons.policyViolation,
  ]),
  revokedAt: CertificateAuthorityTimestampSchema,
  revokedByActorId: CertificateAuthorityIdentifierSchema.optional(),
  note: z.string().trim().max(2000).optional(),
});

const CertificateDistributionTargetKindSchema = z.enum([
  CertificateDistributionTargetKinds.node,
  CertificateDistributionTargetKinds.server,
  CertificateDistributionTargetKinds.device,
  CertificateDistributionTargetKinds.service,
]);

const CertificateDistributionEventStatusSchema = z.enum([
  CertificateDistributionEventStatuses.queued,
  CertificateDistributionEventStatuses.published,
  CertificateDistributionEventStatuses.failed,
  CertificateDistributionEventStatuses.acknowledged,
]);

const CertificateAuthorityIntrospectionStateSchema = z.enum([
  CertificateAuthorityIntrospectionStates.healthy,
  CertificateAuthorityIntrospectionStates.uninitialized,
  CertificateAuthorityIntrospectionStates.degraded,
  CertificateAuthorityIntrospectionStates.blocked,
]);

const CertificateAuthorityIntrospectionDiagnosticSeveritySchema = z.enum([
  CertificateAuthorityIntrospectionDiagnosticSeverities.info,
  CertificateAuthorityIntrospectionDiagnosticSeverities.warning,
  CertificateAuthorityIntrospectionDiagnosticSeverities.error,
]);

export const TrustMaterialReferencePersistenceRecordSchema = z.object({
  materialRef: CertificateAuthorityIdentifierSchema,
  kind: TrustMaterialKindSchema,
  storageLocator: z.string().trim().min(1).max(1024),
  fingerprintSha256: z.string().trim().max(256).optional(),
  createdAt: CertificateAuthorityTimestampSchema,
  createdBy: CertificateAuthorityIdentifierSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  lastModifiedBy: CertificateAuthorityIdentifierSchema,
  revision: z.number().int().nonnegative(),
});

export const CertificateAuthorityRootPersistenceRecordSchema = z.object({
  certificateAuthorityId: CertificateAuthorityIdentifierSchema,
  displayName: z.string().trim().min(1).max(255),
  status: CertificateAuthorityStatusSchema,
  subject: CertificateSubjectPersistenceRecordSchema,
  serialNumber: z.string().trim().toUpperCase().regex(SerialPattern),
  validity: CertificateValidityWindowPersistenceRecordSchema,
  signatureAlgorithm: z.string().trim().min(1).max(255),
  rootCertificateMaterialRef: CertificateAuthorityIdentifierSchema,
  rootPrivateKeyMaterialRef: CertificateAuthorityIdentifierSchema,
  rotationPolicy: RotationPolicyMetadataPersistenceRecordSchema,
  rotatedFromCertificateAuthorityId: CertificateAuthorityIdentifierSchema.optional(),
  retiredAt: CertificateAuthorityTimestampSchema.optional(),
  compromisedAt: CertificateAuthorityTimestampSchema.optional(),
  createdAt: CertificateAuthorityTimestampSchema,
  createdBy: CertificateAuthorityIdentifierSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  lastModifiedBy: CertificateAuthorityIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (value.status === CertificateAuthorityStatuses.retired && !value.retiredAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["retiredAt"],
      message: "Retired certificate authority records require retiredAt.",
    });
  }

  if (value.status === CertificateAuthorityStatuses.compromised && !value.compromisedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compromisedAt"],
      message: "Compromised certificate authority records require compromisedAt.",
    });
  }
});

export const IssuedCertificatePersistenceRecordSchema = z.object({
  certificateAuthorityId: CertificateAuthorityIdentifierSchema,
  serialNumber: z.string().trim().toUpperCase().regex(SerialPattern),
  status: CertificateStatusSchema,
  subject: CertificateSubjectPersistenceRecordSchema,
  subjectReference: CertificateSubjectReferencePersistenceRecordSchema,
  usages: z.array(CertificateUsageKindSchema)
    .min(1, "Issued certificates must include at least one usage."),
  validity: CertificateValidityWindowPersistenceRecordSchema,
  issuedAt: CertificateAuthorityTimestampSchema,
  certificateMaterialRef: CertificateAuthorityIdentifierSchema,
  certificateChainMaterialRef: CertificateAuthorityIdentifierSchema.optional(),
  trustMaterialRef: CertificateAuthorityIdentifierSchema.optional(),
  publicKeyAlgorithm: z.string().trim().min(1).max(255),
  publicKeyFingerprintSha256: z.string().trim().max(256).optional(),
  revocation: CertificateRevocationPersistenceRecordSchema.optional(),
  supersededBySerialNumber: z.string().trim().toUpperCase().regex(SerialPattern).optional(),
  createdAt: CertificateAuthorityTimestampSchema,
  createdBy: CertificateAuthorityIdentifierSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  lastModifiedBy: CertificateAuthorityIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (value.status === CertificateStatuses.revoked && !value.revocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revocation"],
      message: "Revoked certificate records require revocation metadata.",
    });
  }

  if (value.status !== CertificateStatuses.revoked && value.revocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "Only revoked certificate records can include revocation metadata.",
    });
  }

  if (value.status === CertificateStatuses.superseded && !value.supersededBySerialNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supersededBySerialNumber"],
      message: "Superseded certificate records require supersededBySerialNumber.",
    });
  }
});

export const CertificateStatusHistoryPersistenceRecordSchema = z.object({
  statusEventId: CertificateAuthorityIdentifierSchema,
  certificateAuthorityId: CertificateAuthorityIdentifierSchema,
  serialNumber: z.string().trim().toUpperCase().regex(SerialPattern),
  previousStatus: CertificateStatusSchema.optional(),
  currentStatus: CertificateStatusSchema,
  occurredAt: CertificateAuthorityTimestampSchema,
  occurredBy: CertificateAuthorityIdentifierSchema,
  reason: z.string().trim().max(512).optional(),
  note: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.previousStatus && value.previousStatus === value.currentStatus) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["currentStatus"],
      message: "Certificate status history events cannot repeat the same previous and current status.",
    });
  }
});

export const CertificateRevocationHistoryPersistenceRecordSchema = z.object({
  revocationId: CertificateAuthorityIdentifierSchema,
  certificateAuthorityId: CertificateAuthorityIdentifierSchema,
  serialNumber: z.string().trim().toUpperCase().regex(SerialPattern),
  reason: z.enum([
    CertificateRevocationReasons.unspecified,
    CertificateRevocationReasons.keyCompromise,
    CertificateRevocationReasons.caCompromise,
    CertificateRevocationReasons.affiliationChanged,
    CertificateRevocationReasons.superseded,
    CertificateRevocationReasons.cessationOfOperation,
    CertificateRevocationReasons.privilegeWithdrawn,
    CertificateRevocationReasons.policyViolation,
  ]),
  revokedAt: CertificateAuthorityTimestampSchema,
  revokedByActorId: CertificateAuthorityIdentifierSchema.optional(),
  note: z.string().trim().max(2000).optional(),
  createdAt: CertificateAuthorityTimestampSchema,
  createdBy: CertificateAuthorityIdentifierSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  lastModifiedBy: CertificateAuthorityIdentifierSchema,
  revision: z.number().int().nonnegative(),
});

export const CertificateDistributionEventPersistenceRecordSchema = z.object({
  distributionEventId: CertificateAuthorityIdentifierSchema,
  materialRef: CertificateAuthorityIdentifierSchema,
  certificateAuthorityId: CertificateAuthorityIdentifierSchema.optional(),
  serialNumber: z.string().trim().toUpperCase().regex(SerialPattern).optional(),
  targetKind: CertificateDistributionTargetKindSchema,
  targetReferenceId: CertificateAuthorityIdentifierSchema,
  workspaceId: CertificateAuthorityIdentifierSchema.optional(),
  transport: z.string().trim().min(1).max(255),
  deliveryLocatorRef: z.string().trim().min(1).max(1024).optional(),
  status: CertificateDistributionEventStatusSchema,
  occurredAt: CertificateAuthorityTimestampSchema,
  occurredBy: CertificateAuthorityIdentifierSchema,
  failureReason: z.string().trim().max(1024).optional(),
  createdAt: CertificateAuthorityTimestampSchema,
  createdBy: CertificateAuthorityIdentifierSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  lastModifiedBy: CertificateAuthorityIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (value.status === CertificateDistributionEventStatuses.failed && !value.failureReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["failureReason"],
      message: "Failed distribution events require failureReason.",
    });
  }
});

export const CertificateAuthorityCertificateCountSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  issued: z.number().int().nonnegative(),
  revoked: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  superseded: z.number().int().nonnegative(),
  activeAtAsOf: z.number().int().nonnegative(),
});

export const CertificateAuthorityRotationCheckpointSchema = z.object({
  recommendedRotationAt: CertificateAuthorityTimestampSchema,
  configuredNextRotationDueAt: CertificateAuthorityTimestampSchema.optional(),
  daysUntilRecommendedRotation: z.number().int(),
  isDue: z.boolean(),
  isOverdue: z.boolean(),
});

export const CertificateAuthorityStatusHealthFlagsSchema = z.object({
  startupHealthy: z.boolean(),
  configurationBlocked: z.boolean(),
  authorityActive: z.boolean(),
  rotationDueSoon: z.boolean(),
  rotationOverdue: z.boolean(),
  hasRevokedCertificates: z.boolean(),
  hasExpiringCertificates: z.boolean(),
  hasDistributionFailures: z.boolean(),
});

export const CertificateAuthorityIntrospectionDiagnosticSchema = z.object({
  code: z.string().trim().min(1).max(255),
  severity: CertificateAuthorityIntrospectionDiagnosticSeveritySchema,
  message: z.string().trim().min(1).max(1024),
});

export const CertificateAuthorityIntrospectionAuthoritySchema = z.object({
  certificateAuthorityId: CertificateAuthorityIdentifierSchema,
  displayName: z.string().trim().min(1).max(255),
  createdAt: CertificateAuthorityTimestampSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  status: CertificateAuthorityStatusSchema,
  validityNotBefore: CertificateAuthorityTimestampSchema,
  validityNotAfter: CertificateAuthorityTimestampSchema,
  certificateCounts: CertificateAuthorityCertificateCountSummarySchema,
  lastIssuedAt: CertificateAuthorityTimestampSchema.optional(),
  rotationCheckpoint: CertificateAuthorityRotationCheckpointSchema,
});

export const CertificateAuthorityStatusIntrospectionViewSchema = z.object({
  asOf: CertificateAuthorityTimestampSchema,
  initialized: z.boolean(),
  active: z.boolean(),
  blocked: z.boolean(),
  state: CertificateAuthorityIntrospectionStateSchema,
  certificateAuthorityId: CertificateAuthorityIdentifierSchema.optional(),
  authority: CertificateAuthorityIntrospectionAuthoritySchema.optional(),
  diagnostics: z.array(CertificateAuthorityIntrospectionDiagnosticSchema),
  healthFlags: CertificateAuthorityStatusHealthFlagsSchema,
});

const CertificateTrustEvaluationStatusSchema = z.enum([
  "active",
  "revoked",
  "expired",
  "superseded",
  "not-yet-valid",
  "not-found",
  "subject-inactive",
  "invalid",
]);

export const IssuedCertificateOperationalTrustViewSchema = z.object({
  status: CertificateTrustEvaluationStatusSchema,
  active: z.boolean(),
  revoked: z.boolean(),
  expired: z.boolean(),
  usable: z.boolean(),
  checkedAt: CertificateAuthorityTimestampSchema,
});

export const IssuedCertificateMetadataViewSchema = z.object({
  certificateAuthorityId: CertificateAuthorityIdentifierSchema,
  serialNumber: z.string().trim().toUpperCase().regex(SerialPattern),
  status: CertificateStatusSchema,
  trust: IssuedCertificateOperationalTrustViewSchema,
  subject: CertificateSubjectPersistenceRecordSchema,
  subjectReference: CertificateSubjectReferencePersistenceRecordSchema,
  usages: z.array(CertificateUsageKindSchema).min(1),
  validity: CertificateValidityWindowPersistenceRecordSchema,
  issuedAt: CertificateAuthorityTimestampSchema,
  publicKeyAlgorithm: z.string().trim().min(1).max(255),
  publicKeyFingerprintSha256: z.string().trim().max(256).optional(),
  revocation: CertificateRevocationPersistenceRecordSchema.optional(),
  supersededBySerialNumber: z.string().trim().toUpperCase().regex(SerialPattern).optional(),
  createdAt: CertificateAuthorityTimestampSchema,
  createdBy: CertificateAuthorityIdentifierSchema,
  lastModifiedAt: CertificateAuthorityTimestampSchema,
  lastModifiedBy: CertificateAuthorityIdentifierSchema,
});

export const CertificateMetadataListPaginationSchema = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export const CertificateMetadataListViewSchema = z.object({
  asOf: CertificateAuthorityTimestampSchema,
  items: z.array(IssuedCertificateMetadataViewSchema),
  pagination: CertificateMetadataListPaginationSchema,
});

export type RotationPolicyMetadataPersistenceRecordPayload = z.infer<typeof RotationPolicyMetadataPersistenceRecordSchema>;
export type CertificateValidityWindowPersistenceRecordPayload = z.infer<typeof CertificateValidityWindowPersistenceRecordSchema>;
export type CertificateSubjectPersistenceRecordPayload = z.infer<typeof CertificateSubjectPersistenceRecordSchema>;
export type CertificateSubjectReferencePersistenceRecordPayload = z.infer<typeof CertificateSubjectReferencePersistenceRecordSchema>;
export type CertificateRevocationPersistenceRecordPayload = z.infer<typeof CertificateRevocationPersistenceRecordSchema>;
export type TrustMaterialReferencePersistenceRecordPayload = z.infer<typeof TrustMaterialReferencePersistenceRecordSchema>;
export type CertificateAuthorityRootPersistenceRecordPayload = z.infer<typeof CertificateAuthorityRootPersistenceRecordSchema>;
export type IssuedCertificatePersistenceRecordPayload = z.infer<typeof IssuedCertificatePersistenceRecordSchema>;
export type CertificateStatusHistoryPersistenceRecordPayload = z.infer<typeof CertificateStatusHistoryPersistenceRecordSchema>;
export type CertificateRevocationHistoryPersistenceRecordPayload = z.infer<typeof CertificateRevocationHistoryPersistenceRecordSchema>;
export type CertificateDistributionEventPersistenceRecordPayload = z.infer<typeof CertificateDistributionEventPersistenceRecordSchema>;
export type CertificateAuthorityStatusIntrospectionViewPayload = z.infer<typeof CertificateAuthorityStatusIntrospectionViewSchema>;
export type IssuedCertificateMetadataViewPayload = z.infer<typeof IssuedCertificateMetadataViewSchema>;
export type CertificateMetadataListViewPayload = z.infer<typeof CertificateMetadataListViewSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(
  schemaName: string,
  error: z.ZodError,
): CertificateAuthoritySchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new CertificateAuthoritySchemaValidationError(schemaName, issues);
}

function parseCertificateAuthoritySchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseCertificateAuthorityRootPersistenceRecord(
  payload: unknown,
): CertificateAuthorityRootPersistenceRecordPayload {
  return parseCertificateAuthoritySchema(
    "CertificateAuthorityRootPersistenceRecord",
    CertificateAuthorityRootPersistenceRecordSchema,
    payload,
  );
}

export function parseIssuedCertificatePersistenceRecord(
  payload: unknown,
): IssuedCertificatePersistenceRecordPayload {
  return parseCertificateAuthoritySchema(
    "IssuedCertificatePersistenceRecord",
    IssuedCertificatePersistenceRecordSchema,
    payload,
  );
}

export function parseTrustMaterialReferencePersistenceRecord(
  payload: unknown,
): TrustMaterialReferencePersistenceRecordPayload {
  return parseCertificateAuthoritySchema(
    "TrustMaterialReferencePersistenceRecord",
    TrustMaterialReferencePersistenceRecordSchema,
    payload,
  );
}

export function parseCertificateStatusHistoryPersistenceRecord(
  payload: unknown,
): CertificateStatusHistoryPersistenceRecordPayload {
  return parseCertificateAuthoritySchema(
    "CertificateStatusHistoryPersistenceRecord",
    CertificateStatusHistoryPersistenceRecordSchema,
    payload,
  );
}

export function parseCertificateRevocationHistoryPersistenceRecord(
  payload: unknown,
): CertificateRevocationHistoryPersistenceRecordPayload {
  return parseCertificateAuthoritySchema(
    "CertificateRevocationHistoryPersistenceRecord",
    CertificateRevocationHistoryPersistenceRecordSchema,
    payload,
  );
}

export function parseCertificateDistributionEventPersistenceRecord(
  payload: unknown,
): CertificateDistributionEventPersistenceRecordPayload {
  return parseCertificateAuthoritySchema(
    "CertificateDistributionEventPersistenceRecord",
    CertificateDistributionEventPersistenceRecordSchema,
    payload,
  );
}

export function parseCertificateAuthorityStatusIntrospectionView(
  payload: unknown,
): CertificateAuthorityStatusIntrospectionViewPayload {
  return parseCertificateAuthoritySchema(
    "CertificateAuthorityStatusIntrospectionView",
    CertificateAuthorityStatusIntrospectionViewSchema,
    payload,
  );
}

export function parseIssuedCertificateMetadataView(
  payload: unknown,
): IssuedCertificateMetadataViewPayload {
  return parseCertificateAuthoritySchema(
    "IssuedCertificateMetadataView",
    IssuedCertificateMetadataViewSchema,
    payload,
  );
}

export function parseCertificateMetadataListView(
  payload: unknown,
): CertificateMetadataListViewPayload {
  return parseCertificateAuthoritySchema(
    "CertificateMetadataListView",
    CertificateMetadataListViewSchema,
    payload,
  );
}
