import path from "node:path";
import { z } from "zod";
import {
  RuntimeRepositoryInstallerKinds,
  createRuntimeRepositoryDiagnosticsRequest,
  createRuntimeRepositoryInstallRequest,
  createRuntimeRepositoryStatusRequest,
  createRuntimeRepositoryUpdateRequest,
  createRuntimeRepositoryValidationRequest,
  type RuntimeRepositoryDiagnosticsRequest,
  type RuntimeRepositoryInstallRequest,
  type RuntimeRepositoryStatusRequest,
  type RuntimeRepositoryUpdateRequest,
  type RuntimeRepositoryValidationRequest,
} from "./RuntimeRepositoryInstallerContract";

const nonEmptyStringSchema = z.string().trim().min(1);

export const ComfyRuntimeInstallationAssetId = "asset:config-profile:comfyui-runtime-installation";
export const ComfyRuntimeInstallationAssetVersionId = "asset:config-profile:comfyui-runtime-installation:v1";
export const ComfyRuntimeInstallationAssetContractVersion = "1.0.0";
export const ComfyRuntimeDependencyId = "runtime:comfyui";
export const ComfyRuntimeBackendId = "runtime:comfyui";

export const ComfyRuntimeRevisionKinds = Object.freeze({
  branch: "branch",
  tag: "tag",
  commit: "commit",
} as const);

type ComfyRuntimeRevisionKind = (typeof ComfyRuntimeRevisionKinds)[keyof typeof ComfyRuntimeRevisionKinds];

const revisionPinningSchema = z.object({
  defaultKind: z.enum([ComfyRuntimeRevisionKinds.branch, ComfyRuntimeRevisionKinds.tag, ComfyRuntimeRevisionKinds.commit]),
  defaultValue: nonEmptyStringSchema,
  supportsOverride: z.boolean().default(true),
  supportedKinds: z.array(z.enum([
    ComfyRuntimeRevisionKinds.branch,
    ComfyRuntimeRevisionKinds.tag,
    ComfyRuntimeRevisionKinds.commit,
  ])).min(1),
});

const repositorySourceSchema = z.object({
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  repositoryKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  repositoryUri: nonEmptyStringSchema,
  revisionPinning: revisionPinningSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const installTargetSchema = z.object({
  targetRootPurpose: nonEmptyStringSchema,
  targetRootKey: nonEmptyStringSchema,
  deterministicLocationStrategy: z.literal("runtime-repository-install-location-key"),
  allowCustomInstallLocationKey: z.boolean().default(true),
});

const runtimeStartSchema = z.object({
  command: nonEmptyStringSchema,
  args: z.array(nonEmptyStringSchema).default([]),
  workingDirectoryRelativePath: z.string().trim().default("."),
  defaultPort: z.number().int().positive(),
  defaultHost: nonEmptyStringSchema.default("127.0.0.1"),
});

const runtimeHealthSchema = z.object({
  expectedReadinessPath: nonEmptyStringSchema,
  expectedLivenessPath: nonEmptyStringSchema,
  expectedStatusCodes: z.array(z.number().int().min(100).max(599)).min(1),
  startupTimeoutMs: z.number().int().positive(),
  pollIntervalMs: z.number().int().positive(),
});

const dependencyRequirementSchema = z.object({
  requirementId: nonEmptyStringSchema,
  category: z.enum(["python", "pip", "models", "runtime-feature", "custom-node"]),
  requirementRef: nonEmptyStringSchema,
  required: z.boolean().default(true),
  notes: z.string().trim().optional(),
});

const validationSchema = z.object({
  requiredRepositoryPaths: z.array(nonEmptyStringSchema).min(1),
  requiresRuntimeHealthCheck: z.boolean().default(true),
  allowsPartialPhases: z.boolean().default(true),
});

const diagnosticsSchema = z.object({
  defaultIssueCodes: z.array(nonEmptyStringSchema).min(1),
  includeRepositoryDiagnosticsByDefault: z.boolean().default(true),
  inspectableRuntimeMetadataKeys: z.array(nonEmptyStringSchema).default([]),
});

export const ComfyRuntimeInstallationAssetSchema = z.object({
  assetId: z.literal(ComfyRuntimeInstallationAssetId),
  versionId: z.literal(ComfyRuntimeInstallationAssetVersionId),
  contractVersion: z.literal(ComfyRuntimeInstallationAssetContractVersion),
  summary: nonEmptyStringSchema,
  runtimeDependencyId: nonEmptyStringSchema.default(ComfyRuntimeDependencyId),
  backendId: nonEmptyStringSchema.default(ComfyRuntimeBackendId),
  source: repositorySourceSchema,
  installTarget: installTargetSchema,
  runtimeStart: runtimeStartSchema,
  runtimeHealth: runtimeHealthSchema,
  requiredCapabilities: z.array(nonEmptyStringSchema).min(1),
  installRequirements: z.array(dependencyRequirementSchema).min(1),
  validation: validationSchema,
  diagnostics: diagnosticsSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ComfyRuntimeInstallationAsset = z.infer<typeof ComfyRuntimeInstallationAssetSchema>;

export interface ResolveComfyRuntimeInstallerRequestInput {
  readonly runtimeAsset?: ComfyRuntimeInstallationAsset;
  readonly targetRootDirectory: string;
  readonly requestedRevision?: {
    readonly kind: ComfyRuntimeRevisionKind;
    readonly value: string;
  };
  readonly installLocationKey?: string;
  readonly includeRepositoryDiagnostics?: boolean;
  readonly expectedRevision?: string;
}

export interface ResolvedComfyRuntimeInstallerRequests {
  readonly runtimeAsset: ComfyRuntimeInstallationAsset;
  readonly installRequest: RuntimeRepositoryInstallRequest;
  readonly updateRequest: RuntimeRepositoryUpdateRequest;
  readonly statusRequest: RuntimeRepositoryStatusRequest;
  readonly validationRequest: RuntimeRepositoryValidationRequest;
  readonly diagnosticsRequest: RuntimeRepositoryDiagnosticsRequest;
}

export const ComfyRuntimeInstallationAsset: ComfyRuntimeInstallationAsset = createComfyRuntimeInstallationAsset({
  assetId: ComfyRuntimeInstallationAssetId,
  versionId: ComfyRuntimeInstallationAssetVersionId,
  contractVersion: ComfyRuntimeInstallationAssetContractVersion,
  summary: "Provisioned ComfyUI runtime installation profile for image manipulation system defaults.",
  runtimeDependencyId: ComfyRuntimeDependencyId,
  backendId: ComfyRuntimeBackendId,
  source: {
    installerKind: RuntimeRepositoryInstallerKinds.git,
    repositoryKind: RuntimeRepositoryInstallerKinds.git,
    repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
    revisionPinning: {
      defaultKind: ComfyRuntimeRevisionKinds.branch,
      defaultValue: "master",
      supportsOverride: true,
      supportedKinds: [
        ComfyRuntimeRevisionKinds.branch,
        ComfyRuntimeRevisionKinds.tag,
        ComfyRuntimeRevisionKinds.commit,
      ],
    },
    metadata: {
      sourceProvider: "github",
      ownership: "shared",
    },
  },
  installTarget: {
    targetRootPurpose: "shared-runtime-repository-store",
    targetRootKey: "runtime-repositories",
    deterministicLocationStrategy: "runtime-repository-install-location-key",
    allowCustomInstallLocationKey: true,
  },
  runtimeStart: {
    command: "python",
    args: ["main.py", "--listen", "127.0.0.1", "--port", "8188"],
    workingDirectoryRelativePath: ".",
    defaultPort: 8188,
    defaultHost: "127.0.0.1",
  },
  runtimeHealth: {
    expectedReadinessPath: "/system_stats",
    expectedLivenessPath: "/queue",
    expectedStatusCodes: [200],
    startupTimeoutMs: 120000,
    pollIntervalMs: 1000,
  },
  requiredCapabilities: [
    "comfyui-api",
    "workflow-template-execution",
    "image-generation",
    "dataset-runtime-handles",
  ],
  installRequirements: [
    {
      requirementId: "python-runtime",
      category: "python",
      requirementRef: "python>=3.10",
      required: true,
      notes: "ComfyUI runtime process host.",
    },
    {
      requirementId: "pip-requirements",
      category: "pip",
      requirementRef: "requirements.txt",
      required: true,
      notes: "ComfyUI Python dependencies.",
    },
    {
      requirementId: "custom-node-root",
      category: "custom-node",
      requirementRef: "custom_nodes/",
      required: false,
      notes: "Reserved for optional custom-node installation phase.",
    },
    {
      requirementId: "model-presence-validation",
      category: "models",
      requirementRef: "models/checkpoints",
      required: true,
      notes: "Bounded model-presence validation seam.",
    },
  ],
  validation: {
    requiredRepositoryPaths: ["main.py", "requirements.txt", "custom_nodes"],
    requiresRuntimeHealthCheck: true,
    allowsPartialPhases: true,
  },
  diagnostics: {
    defaultIssueCodes: [
      "repository-install-failed",
      "environment-preparation-failed",
      "dependency-install-failed",
      "custom-node-install-not-implemented",
      "model-validation-not-implemented",
      "runtime-validation-not-implemented",
    ],
    includeRepositoryDiagnosticsByDefault: true,
    inspectableRuntimeMetadataKeys: ["resolvedRevision", "installDirectory", "healthEndpoint"],
  },
  metadata: {
    runtimeProfile: "comfyui",
    scope: "image-manipulation-default",
  },
});

export function createComfyRuntimeInstallationAsset(input: ComfyRuntimeInstallationAsset): ComfyRuntimeInstallationAsset {
  const parsed = ComfyRuntimeInstallationAssetSchema.parse(input);
  return Object.freeze({
    ...parsed,
    source: Object.freeze({
      ...parsed.source,
      revisionPinning: Object.freeze({
        ...parsed.source.revisionPinning,
        supportedKinds: Object.freeze([...parsed.source.revisionPinning.supportedKinds]),
      }),
      metadata: Object.freeze({ ...parsed.source.metadata }),
    }),
    installTarget: Object.freeze({ ...parsed.installTarget }),
    runtimeStart: Object.freeze({
      ...parsed.runtimeStart,
      args: Object.freeze([...parsed.runtimeStart.args]),
    }),
    runtimeHealth: Object.freeze({ ...parsed.runtimeHealth, expectedStatusCodes: Object.freeze([...parsed.runtimeHealth.expectedStatusCodes]) }),
    requiredCapabilities: Object.freeze([...parsed.requiredCapabilities]),
    installRequirements: Object.freeze(parsed.installRequirements.map((entry) => Object.freeze({ ...entry }))),
    validation: Object.freeze({
      ...parsed.validation,
      requiredRepositoryPaths: Object.freeze([...parsed.validation.requiredRepositoryPaths]),
    }),
    diagnostics: Object.freeze({
      ...parsed.diagnostics,
      defaultIssueCodes: Object.freeze([...parsed.diagnostics.defaultIssueCodes]),
      inspectableRuntimeMetadataKeys: Object.freeze([...parsed.diagnostics.inspectableRuntimeMetadataKeys]),
    }),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function resolveComfyRuntimeInstallerRequests(
  input: ResolveComfyRuntimeInstallerRequestInput,
): ResolvedComfyRuntimeInstallerRequests {
  const runtimeAsset = createComfyRuntimeInstallationAsset(input.runtimeAsset ?? ComfyRuntimeInstallationAsset);
  const targetRootDirectory = nonEmptyStringSchema.parse(input.targetRootDirectory);
  const requestedRevision = resolveRequestedRevision(runtimeAsset, input.requestedRevision);
  const installLocationKey = input.installLocationKey?.trim() || undefined;

  const requestMetadata = Object.freeze({
    runtimeAssetId: runtimeAsset.assetId,
    runtimeAssetVersionId: runtimeAsset.versionId,
    runtimeProfile: runtimeAsset.metadata.runtimeProfile,
    installTargetKey: runtimeAsset.installTarget.targetRootKey,
  });

  const installRequest = createRuntimeRepositoryInstallRequest({
    runtimeDependencyId: runtimeAsset.runtimeDependencyId,
    installerKind: runtimeAsset.source.installerKind,
    source: {
      repositoryKind: runtimeAsset.source.repositoryKind,
      repositoryUri: runtimeAsset.source.repositoryUri,
      requestedRevision,
      metadata: runtimeAsset.source.metadata,
    },
    targetRootDirectory,
    installLocationKey,
    allowRecovery: true,
    metadata: requestMetadata,
  });

  const updateRequest = createRuntimeRepositoryUpdateRequest({
    runtimeDependencyId: runtimeAsset.runtimeDependencyId,
    installerKind: runtimeAsset.source.installerKind,
    source: {
      repositoryKind: runtimeAsset.source.repositoryKind,
      repositoryUri: runtimeAsset.source.repositoryUri,
      requestedRevision,
      metadata: runtimeAsset.source.metadata,
    },
    targetRootDirectory,
    installLocationKey,
    metadata: requestMetadata,
  });

  const statusRequest = createRuntimeRepositoryStatusRequest({
    runtimeDependencyId: runtimeAsset.runtimeDependencyId,
    installerKind: runtimeAsset.source.installerKind,
    source: {
      repositoryKind: runtimeAsset.source.repositoryKind,
      repositoryUri: runtimeAsset.source.repositoryUri,
      requestedRevision,
      metadata: runtimeAsset.source.metadata,
    },
    targetRootDirectory,
    installLocationKey,
  });

  const validationRequest = createRuntimeRepositoryValidationRequest({
    ...statusRequest,
    expectedRevision: input.expectedRevision?.trim() || requestedRevision,
  });

  const diagnosticsRequest = createRuntimeRepositoryDiagnosticsRequest({
    ...statusRequest,
    includeCommandDiagnostics: input.includeRepositoryDiagnostics
      ?? runtimeAsset.diagnostics.includeRepositoryDiagnosticsByDefault,
  });

  return Object.freeze({
    runtimeAsset,
    installRequest,
    updateRequest,
    statusRequest,
    validationRequest,
    diagnosticsRequest,
  });
}

export function resolveComfyRuntimeWorkingDirectory(input: {
  readonly runtimeAsset?: ComfyRuntimeInstallationAsset;
  readonly installDirectory: string;
}): string {
  const runtimeAsset = input.runtimeAsset ?? ComfyRuntimeInstallationAsset;
  const installDirectory = nonEmptyStringSchema.parse(input.installDirectory);
  const relativePath = runtimeAsset.runtimeStart.workingDirectoryRelativePath.trim();
  const resolved = relativePath === "."
    ? installDirectory
    : path.resolve(installDirectory, relativePath);
  return resolved;
}

function resolveRequestedRevision(
  runtimeAsset: ComfyRuntimeInstallationAsset,
  requestedRevision?: { readonly kind: ComfyRuntimeRevisionKind; readonly value: string },
): string {
  if (!requestedRevision) {
    return runtimeAsset.source.revisionPinning.defaultValue;
  }

  if (!runtimeAsset.source.revisionPinning.supportsOverride) {
    return runtimeAsset.source.revisionPinning.defaultValue;
  }

  if (!runtimeAsset.source.revisionPinning.supportedKinds.includes(requestedRevision.kind)) {
    throw new Error(`Comfy runtime does not support revision kind '${requestedRevision.kind}'.`);
  }

  const value = requestedRevision.value.trim();
  if (!value) {
    throw new Error("Comfy runtime requested revision value cannot be empty.");
  }
  return value;
}
