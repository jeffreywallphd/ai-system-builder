import { z } from "zod";

const nonEmptyStringSchema = z.string().trim().min(1);
const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const RuntimeRepositoryInstallerKinds = Object.freeze({
  git: "git",
} as const);

export type RuntimeRepositoryInstallerKind =
  | (typeof RuntimeRepositoryInstallerKinds)[keyof typeof RuntimeRepositoryInstallerKinds]
  | string;

export const RuntimeRepositorySourceMetadataSchema = z.object({
  repositoryKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  repositoryUri: nonEmptyStringSchema,
  requestedRevision: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export type RuntimeRepositorySourceMetadata = z.infer<typeof RuntimeRepositorySourceMetadataSchema>;

export const RuntimeRepositoryInstallLocationRequestSchema = z.object({
  runtimeDependencyId: nonEmptyStringSchema,
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  source: RuntimeRepositorySourceMetadataSchema,
  targetRootDirectory: nonEmptyStringSchema,
  installLocationKey: nonEmptyStringSchema.optional(),
});

export type RuntimeRepositoryInstallLocationRequest = z.infer<typeof RuntimeRepositoryInstallLocationRequestSchema>;

export const RuntimeRepositoryInstallLocationSchema = z.object({
  installLocationKey: nonEmptyStringSchema,
  installDirectory: nonEmptyStringSchema,
  targetRootDirectory: nonEmptyStringSchema,
});

export type RuntimeRepositoryInstallLocation = z.infer<typeof RuntimeRepositoryInstallLocationSchema>;

export const RuntimeRepositoryOperationErrorSchema = z.object({
  code: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  retryable: z.boolean().default(false),
  metadata: metadataSchema,
});

export type RuntimeRepositoryOperationError = z.infer<typeof RuntimeRepositoryOperationErrorSchema>;

export const RuntimeRepositoryIssueSchema = z.object({
  code: nonEmptyStringSchema,
  severity: z.enum(["error", "warning"]).default("error"),
  message: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type RuntimeRepositoryIssue = z.infer<typeof RuntimeRepositoryIssueSchema>;

export const RuntimeRepositoryInstallationStates = Object.freeze({
  notInstalled: "not-installed",
  partiallyInstalled: "partially-installed",
  installed: "installed",
  invalid: "invalid",
} as const);

export type RuntimeRepositoryInstallationState =
  (typeof RuntimeRepositoryInstallationStates)[keyof typeof RuntimeRepositoryInstallationStates];

export const InstalledRuntimeRepositoryMetadataSchema = z.object({
  runtimeDependencyId: nonEmptyStringSchema,
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  source: RuntimeRepositorySourceMetadataSchema,
  installLocation: RuntimeRepositoryInstallLocationSchema,
  resolvedRevision: nonEmptyStringSchema.optional(),
  installedAt: nonEmptyStringSchema,
  updatedAt: nonEmptyStringSchema,
  metadata: metadataSchema,
});

export type InstalledRuntimeRepositoryMetadata = z.infer<typeof InstalledRuntimeRepositoryMetadataSchema>;

export const RuntimeRepositoryInstallRequestSchema = z.object({
  runtimeDependencyId: nonEmptyStringSchema,
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  source: RuntimeRepositorySourceMetadataSchema,
  targetRootDirectory: nonEmptyStringSchema,
  installLocationKey: nonEmptyStringSchema.optional(),
  allowRecovery: z.boolean().default(true),
  metadata: metadataSchema,
});

export type RuntimeRepositoryInstallRequest = z.infer<typeof RuntimeRepositoryInstallRequestSchema>;

export const RuntimeRepositoryInstallResultSchema = z.object({
  success: z.boolean(),
  installed: InstalledRuntimeRepositoryMetadataSchema.optional(),
  operation: z.enum(["installed", "already-installed", "failed"]),
  recoveredFromPartial: z.boolean().default(false),
  error: RuntimeRepositoryOperationErrorSchema.optional(),
  issues: z.array(RuntimeRepositoryIssueSchema).default([]),
});

export type RuntimeRepositoryInstallResult = z.infer<typeof RuntimeRepositoryInstallResultSchema>;

export const RuntimeRepositoryUpdateRequestSchema = z.object({
  runtimeDependencyId: nonEmptyStringSchema,
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  source: RuntimeRepositorySourceMetadataSchema,
  targetRootDirectory: nonEmptyStringSchema,
  installLocationKey: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export type RuntimeRepositoryUpdateRequest = z.infer<typeof RuntimeRepositoryUpdateRequestSchema>;

export const RuntimeRepositoryUpdateResultSchema = z.object({
  success: z.boolean(),
  operation: z.enum(["updated", "already-current", "failed"]),
  updated: z.boolean(),
  beforeRevision: nonEmptyStringSchema.optional(),
  afterRevision: nonEmptyStringSchema.optional(),
  installed: InstalledRuntimeRepositoryMetadataSchema.optional(),
  error: RuntimeRepositoryOperationErrorSchema.optional(),
  issues: z.array(RuntimeRepositoryIssueSchema).default([]),
});

export type RuntimeRepositoryUpdateResult = z.infer<typeof RuntimeRepositoryUpdateResultSchema>;

export const RuntimeRepositoryStatusRequestSchema = z.object({
  runtimeDependencyId: nonEmptyStringSchema,
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  source: RuntimeRepositorySourceMetadataSchema,
  targetRootDirectory: nonEmptyStringSchema,
  installLocationKey: nonEmptyStringSchema.optional(),
});

export type RuntimeRepositoryStatusRequest = z.infer<typeof RuntimeRepositoryStatusRequestSchema>;

export const RuntimeRepositoryStatusResultSchema = z.object({
  state: z.enum([
    RuntimeRepositoryInstallationStates.notInstalled,
    RuntimeRepositoryInstallationStates.partiallyInstalled,
    RuntimeRepositoryInstallationStates.installed,
    RuntimeRepositoryInstallationStates.invalid,
  ]),
  installLocation: RuntimeRepositoryInstallLocationSchema,
  installed: InstalledRuntimeRepositoryMetadataSchema.optional(),
  issues: z.array(RuntimeRepositoryIssueSchema).default([]),
});

export type RuntimeRepositoryStatusResult = z.infer<typeof RuntimeRepositoryStatusResultSchema>;

export const RuntimeRepositoryValidationRequestSchema = RuntimeRepositoryStatusRequestSchema.extend({
  expectedRevision: nonEmptyStringSchema.optional(),
});

export type RuntimeRepositoryValidationRequest = z.infer<typeof RuntimeRepositoryValidationRequestSchema>;

export const RuntimeRepositoryValidationResultSchema = z.object({
  valid: z.boolean(),
  status: RuntimeRepositoryStatusResultSchema,
  issues: z.array(RuntimeRepositoryIssueSchema).default([]),
});

export type RuntimeRepositoryValidationResult = z.infer<typeof RuntimeRepositoryValidationResultSchema>;

export const RuntimeRepositoryDiagnosticsRequestSchema = RuntimeRepositoryStatusRequestSchema.extend({
  includeCommandDiagnostics: z.boolean().default(true),
});

export type RuntimeRepositoryDiagnosticsRequest = z.infer<typeof RuntimeRepositoryDiagnosticsRequestSchema>;

export const RuntimeRepositoryDiagnosticsResultSchema = z.object({
  status: RuntimeRepositoryStatusResultSchema,
  commandDiagnostics: z.array(z.object({
    command: nonEmptyStringSchema,
    args: z.array(nonEmptyStringSchema).default([]),
    exitCode: z.number().int(),
    stdout: z.string(),
    stderr: z.string(),
  })).default([]),
  issues: z.array(RuntimeRepositoryIssueSchema).default([]),
});

export type RuntimeRepositoryDiagnosticsResult = z.infer<typeof RuntimeRepositoryDiagnosticsResultSchema>;

export interface IRuntimeRepositoryInstallerContract {
  resolveInstallLocation(request: RuntimeRepositoryInstallLocationRequest): RuntimeRepositoryInstallLocation;
  install(request: RuntimeRepositoryInstallRequest): Promise<RuntimeRepositoryInstallResult>;
  update(request: RuntimeRepositoryUpdateRequest): Promise<RuntimeRepositoryUpdateResult>;
  inspectStatus(request: RuntimeRepositoryStatusRequest): Promise<RuntimeRepositoryStatusResult>;
  validate(request: RuntimeRepositoryValidationRequest): Promise<RuntimeRepositoryValidationResult>;
  collectDiagnostics(request: RuntimeRepositoryDiagnosticsRequest): Promise<RuntimeRepositoryDiagnosticsResult>;
}

export function createRuntimeRepositoryInstallRequest(input: RuntimeRepositoryInstallRequest): RuntimeRepositoryInstallRequest {
  const parsed = RuntimeRepositoryInstallRequestSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createRuntimeRepositoryUpdateRequest(input: RuntimeRepositoryUpdateRequest): RuntimeRepositoryUpdateRequest {
  const parsed = RuntimeRepositoryUpdateRequestSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createRuntimeRepositoryStatusRequest(input: RuntimeRepositoryStatusRequest): RuntimeRepositoryStatusRequest {
  const parsed = RuntimeRepositoryStatusRequestSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
  });
}

export function createRuntimeRepositoryValidationRequest(
  input: RuntimeRepositoryValidationRequest,
): RuntimeRepositoryValidationRequest {
  const parsed = RuntimeRepositoryValidationRequestSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
  });
}

export function createRuntimeRepositoryDiagnosticsRequest(
  input: RuntimeRepositoryDiagnosticsRequest,
): RuntimeRepositoryDiagnosticsRequest {
  const parsed = RuntimeRepositoryDiagnosticsRequestSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
  });
}

export function createRuntimeRepositoryInstallLocationRequest(
  input: RuntimeRepositoryInstallLocationRequest,
): RuntimeRepositoryInstallLocationRequest {
  const parsed = RuntimeRepositoryInstallLocationRequestSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
  });
}

export function createRuntimeRepositoryInstallLocation(input: RuntimeRepositoryInstallLocation): RuntimeRepositoryInstallLocation {
  const parsed = RuntimeRepositoryInstallLocationSchema.parse(input);
  return Object.freeze({ ...parsed });
}

export function createInstalledRuntimeRepositoryMetadata(
  input: InstalledRuntimeRepositoryMetadata,
): InstalledRuntimeRepositoryMetadata {
  const parsed = InstalledRuntimeRepositoryMetadataSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
    installLocation: Object.freeze({ ...parsed.installLocation }),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createRuntimeRepositoryOperationError(input: RuntimeRepositoryOperationError): RuntimeRepositoryOperationError {
  const parsed = RuntimeRepositoryOperationErrorSchema.parse(input);
  return Object.freeze({
    ...parsed,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createRuntimeRepositoryIssue(input: RuntimeRepositoryIssue): RuntimeRepositoryIssue {
  const parsed = RuntimeRepositoryIssueSchema.parse(input);
  return Object.freeze({
    ...parsed,
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function createRuntimeRepositoryInstallLocationKey(input: {
  readonly runtimeDependencyId: string;
  readonly installerKind: string;
  readonly source: Pick<RuntimeRepositorySourceMetadata, "repositoryUri" | "requestedRevision" | "repositoryKind">;
}): string {
  const dependencyId = input.runtimeDependencyId.trim().toLowerCase();
  const installerKind = input.installerKind.trim().toLowerCase();
  const repositoryKind = input.source.repositoryKind.trim().toLowerCase();
  const repositoryUri = input.source.repositoryUri.trim().toLowerCase();
  const requestedRevision = input.source.requestedRevision?.trim().toLowerCase() ?? "";
  if (!dependencyId || !installerKind || !repositoryKind || !repositoryUri) {
    throw new Error("Cannot build runtime repository install location key from empty values.");
  }

  const seed = `${dependencyId}|${installerKind}|${repositoryKind}|${repositoryUri}|${requestedRevision}`;
  const fingerprint = createDeterministicFingerprint(seed);
  return `${dependencyId}--${installerKind}--${fingerprint}`;
}

function createDeterministicFingerprint(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
