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

export type RotationPolicyMetadataPersistenceRecordPayload = z.infer<typeof RotationPolicyMetadataPersistenceRecordSchema>;
export type CertificateValidityWindowPersistenceRecordPayload = z.infer<typeof CertificateValidityWindowPersistenceRecordSchema>;
export type CertificateSubjectPersistenceRecordPayload = z.infer<typeof CertificateSubjectPersistenceRecordSchema>;
export type CertificateSubjectReferencePersistenceRecordPayload = z.infer<typeof CertificateSubjectReferencePersistenceRecordSchema>;
export type CertificateRevocationPersistenceRecordPayload = z.infer<typeof CertificateRevocationPersistenceRecordSchema>;
export type TrustMaterialReferencePersistenceRecordPayload = z.infer<typeof TrustMaterialReferencePersistenceRecordSchema>;
export type CertificateAuthorityRootPersistenceRecordPayload = z.infer<typeof CertificateAuthorityRootPersistenceRecordSchema>;
export type IssuedCertificatePersistenceRecordPayload = z.infer<typeof IssuedCertificatePersistenceRecordSchema>;

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
