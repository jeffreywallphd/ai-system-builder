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

export const ComfyRuntimeWorkflowProfiles = Object.freeze({
  imageManipulationDefault: "image-manipulation-default",
  imageManipulationFaceId: "image-manipulation-faceid",
} as const);

export type ComfyRuntimeWorkflowProfile =
  (typeof ComfyRuntimeWorkflowProfiles)[keyof typeof ComfyRuntimeWorkflowProfiles];

const workflowProfileSchema = z.enum([
  ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
  ComfyRuntimeWorkflowProfiles.imageManipulationFaceId,
]);

export const ComfyRuntimeRequirementApplicability = Object.freeze({
  always: "always",
  faceIdOnly: "faceid-only",
} as const);

const requirementApplicabilitySchema = z.enum([
  ComfyRuntimeRequirementApplicability.always,
  ComfyRuntimeRequirementApplicability.faceIdOnly,
]);

const metadataSchema = z.record(z.string(), z.unknown()).default({});

const repositorySourceSchema = z.object({
  installerKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  repositoryKind: nonEmptyStringSchema.default(RuntimeRepositoryInstallerKinds.git),
  repositoryUri: nonEmptyStringSchema,
  requestedRevision: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export const ComfyRuntimeCustomNodeRequirementSchema = z.object({
  requirementId: nonEmptyStringSchema,
  displayName: nonEmptyStringSchema,
  category: z.enum(["custom-node", "extension"]),
  applicability: requirementApplicabilitySchema.default(ComfyRuntimeRequirementApplicability.always),
  required: z.boolean().default(true),
  repository: repositorySourceSchema,
  installLocationKey: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export type ComfyRuntimeCustomNodeRequirement = z.infer<typeof ComfyRuntimeCustomNodeRequirementSchema>;

export interface ResolvedComfyRuntimeCustomNodeInstallRequests {
  readonly requirement: ComfyRuntimeCustomNodeRequirement;
  readonly installRequest: RuntimeRepositoryInstallRequest;
  readonly updateRequest: RuntimeRepositoryUpdateRequest;
  readonly statusRequest: RuntimeRepositoryStatusRequest;
  readonly validationRequest: RuntimeRepositoryValidationRequest;
  readonly diagnosticsRequest: RuntimeRepositoryDiagnosticsRequest;
}

export function createComfyRuntimeCustomNodeRequirement(
  input: ComfyRuntimeCustomNodeRequirement,
): ComfyRuntimeCustomNodeRequirement {
  const parsed = ComfyRuntimeCustomNodeRequirementSchema.parse(input);
  return Object.freeze({
    ...parsed,
    repository: Object.freeze({
      ...parsed.repository,
      metadata: Object.freeze({ ...parsed.repository.metadata }),
    }),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function resolveComfyRuntimeCustomNodeRequirementsForProfile(input: {
  readonly requirements: ReadonlyArray<ComfyRuntimeCustomNodeRequirement>;
  readonly workflowProfile: ComfyRuntimeWorkflowProfile;
}): ReadonlyArray<ComfyRuntimeCustomNodeRequirement> {
  return Object.freeze(input.requirements.filter((requirement) => {
    const applicability = requirement.applicability;
    if (applicability === ComfyRuntimeRequirementApplicability.always) {
      return true;
    }
    if (applicability === ComfyRuntimeRequirementApplicability.faceIdOnly) {
      return input.workflowProfile === ComfyRuntimeWorkflowProfiles.imageManipulationFaceId;
    }
    return false;
  }));
}

export function resolveComfyRuntimeCustomNodeInstallRequests(input: {
  readonly requirement: ComfyRuntimeCustomNodeRequirement;
  readonly targetRootDirectory: string;
  readonly includeDiagnostics?: boolean;
}): ResolvedComfyRuntimeCustomNodeInstallRequests {
  const requirement = createComfyRuntimeCustomNodeRequirement(input.requirement);
  const targetRootDirectory = nonEmptyStringSchema.parse(input.targetRootDirectory);
  const runtimeDependencyId = `runtime:comfyui:${requirement.category}:${requirement.requirementId}`;
  const metadata = Object.freeze({
    requirementId: requirement.requirementId,
    displayName: requirement.displayName,
    category: requirement.category,
    applicability: requirement.applicability,
    ...requirement.metadata,
  });

  const installRequest = createRuntimeRepositoryInstallRequest({
    runtimeDependencyId,
    installerKind: requirement.repository.installerKind,
    source: {
      repositoryKind: requirement.repository.repositoryKind,
      repositoryUri: requirement.repository.repositoryUri,
      requestedRevision: requirement.repository.requestedRevision,
      metadata: requirement.repository.metadata,
    },
    targetRootDirectory,
    installLocationKey: requirement.installLocationKey,
    allowRecovery: true,
    metadata,
  });

  const updateRequest = createRuntimeRepositoryUpdateRequest({
    runtimeDependencyId,
    installerKind: requirement.repository.installerKind,
    source: {
      repositoryKind: requirement.repository.repositoryKind,
      repositoryUri: requirement.repository.repositoryUri,
      requestedRevision: requirement.repository.requestedRevision,
      metadata: requirement.repository.metadata,
    },
    targetRootDirectory,
    installLocationKey: requirement.installLocationKey,
    metadata,
  });

  const statusRequest = createRuntimeRepositoryStatusRequest({
    runtimeDependencyId,
    installerKind: requirement.repository.installerKind,
    source: {
      repositoryKind: requirement.repository.repositoryKind,
      repositoryUri: requirement.repository.repositoryUri,
      requestedRevision: requirement.repository.requestedRevision,
      metadata: requirement.repository.metadata,
    },
    targetRootDirectory,
    installLocationKey: requirement.installLocationKey,
  });

  const validationRequest = createRuntimeRepositoryValidationRequest({
    ...statusRequest,
    expectedRevision: requirement.repository.requestedRevision,
  });

  const diagnosticsRequest = createRuntimeRepositoryDiagnosticsRequest({
    ...statusRequest,
    includeCommandDiagnostics: input.includeDiagnostics ?? true,
  });

  return Object.freeze({
    requirement,
    installRequest,
    updateRequest,
    statusRequest,
    validationRequest,
    diagnosticsRequest,
  });
}

export const ComfyRuntimeAssetRequirementKinds = Object.freeze({
  checkpoint: "checkpoint",
  vae: "vae",
  faceIdModel: "faceid-model",
  lora: "lora",
  embedding: "embedding",
  customRuntimeAsset: "custom-runtime-asset",
} as const);

const requirementKindSchema = z.enum([
  ComfyRuntimeAssetRequirementKinds.checkpoint,
  ComfyRuntimeAssetRequirementKinds.vae,
  ComfyRuntimeAssetRequirementKinds.faceIdModel,
  ComfyRuntimeAssetRequirementKinds.lora,
  ComfyRuntimeAssetRequirementKinds.embedding,
  ComfyRuntimeAssetRequirementKinds.customRuntimeAsset,
]);

export const ComfyRuntimeAssetValidationStatuses = Object.freeze({
  presentValid: "present-valid",
  missingRequired: "missing-required",
  missingOptional: "missing-optional",
  incompatible: "incompatible",
  unknownUnverifiable: "unknown-unverifiable",
} as const);

export type ComfyRuntimeAssetValidationStatus =
  (typeof ComfyRuntimeAssetValidationStatuses)[keyof typeof ComfyRuntimeAssetValidationStatuses];

export const ComfyRuntimeAssetRequirementSchema = z.object({
  requirementId: nonEmptyStringSchema,
  kind: requirementKindSchema,
  displayName: nonEmptyStringSchema,
  applicability: requirementApplicabilitySchema.default(ComfyRuntimeRequirementApplicability.always),
  required: z.boolean().default(true),
  directoryRelativePath: nonEmptyStringSchema,
  configuredModelName: nonEmptyStringSchema.optional(),
  candidateFileNames: z.array(nonEmptyStringSchema).default([]),
  allowedExtensions: z.array(nonEmptyStringSchema).default([]),
  minimumFileCount: z.number().int().positive().default(1),
  compatibilityCheck: z.enum([
    "filename-or-any",
    "extension-only",
    "directory-presence",
  ]).default("filename-or-any"),
  compatibilityCheckLimitations: nonEmptyStringSchema.optional(),
  metadata: metadataSchema,
});

export type ComfyRuntimeAssetRequirement = z.infer<typeof ComfyRuntimeAssetRequirementSchema>;

export interface ComfyRuntimeAssetValidationIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeAssetValidationEntry {
  readonly requirementId: string;
  readonly kind: ComfyRuntimeAssetRequirement["kind"];
  readonly displayName: string;
  readonly required: boolean;
  readonly applicability: ComfyRuntimeCustomNodeRequirement["applicability"];
  readonly status: ComfyRuntimeAssetValidationStatus;
  readonly inspectedDirectory: string;
  readonly resolvedPath?: string;
  readonly resolvedFileName?: string;
  readonly issues: ReadonlyArray<ComfyRuntimeAssetValidationIssue>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComfyRuntimeAssetValidationSummary {
  readonly total: number;
  readonly presentValid: number;
  readonly missingRequired: number;
  readonly missingOptional: number;
  readonly incompatible: number;
  readonly unknownUnverifiable: number;
}

export interface ComfyRuntimeAssetValidationResult {
  readonly workflowProfile: ComfyRuntimeWorkflowProfile;
  readonly entries: ReadonlyArray<ComfyRuntimeAssetValidationEntry>;
  readonly summary: ComfyRuntimeAssetValidationSummary;
  readonly valid: boolean;
}

export function createComfyRuntimeAssetRequirement(input: ComfyRuntimeAssetRequirement): ComfyRuntimeAssetRequirement {
  const parsed = ComfyRuntimeAssetRequirementSchema.parse(input);
  return Object.freeze({
    ...parsed,
    candidateFileNames: Object.freeze([...parsed.candidateFileNames]),
    allowedExtensions: Object.freeze(parsed.allowedExtensions.map((entry) => normalizeExtension(entry))),
    metadata: Object.freeze({ ...parsed.metadata }),
  });
}

export function resolveComfyRuntimeAssetRequirementsForProfile(input: {
  readonly requirements: ReadonlyArray<ComfyRuntimeAssetRequirement>;
  readonly workflowProfile: ComfyRuntimeWorkflowProfile;
}): ReadonlyArray<ComfyRuntimeAssetRequirement> {
  return Object.freeze(input.requirements.filter((requirement) => {
    if (requirement.applicability === ComfyRuntimeRequirementApplicability.always) {
      return true;
    }
    return input.workflowProfile === ComfyRuntimeWorkflowProfiles.imageManipulationFaceId;
  }));
}

export function resolveComfyRuntimeAssetRequirementDirectory(input: {
  readonly installDirectory: string;
  readonly requirement: ComfyRuntimeAssetRequirement;
}): string {
  return path.resolve(nonEmptyStringSchema.parse(input.installDirectory), input.requirement.directoryRelativePath);
}

export function resolveComfyRuntimeWorkflowProfile(input?: string): ComfyRuntimeWorkflowProfile {
  if (!input) {
    return ComfyRuntimeWorkflowProfiles.imageManipulationDefault;
  }

  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return ComfyRuntimeWorkflowProfiles.imageManipulationDefault;
  }
  return workflowProfileSchema.parse(normalized);
}

export function createComfyRuntimeAssetValidationResult(input: {
  readonly workflowProfile: ComfyRuntimeWorkflowProfile;
  readonly entries: ReadonlyArray<ComfyRuntimeAssetValidationEntry>;
}): ComfyRuntimeAssetValidationResult {
  const summary = summarizeEntries(input.entries);
  return Object.freeze({
    workflowProfile: input.workflowProfile,
    entries: Object.freeze([...input.entries]),
    summary,
    valid: summary.missingRequired === 0 && summary.incompatible === 0,
  });
}

function summarizeEntries(entries: ReadonlyArray<ComfyRuntimeAssetValidationEntry>): ComfyRuntimeAssetValidationSummary {
  const summary = {
    total: entries.length,
    presentValid: 0,
    missingRequired: 0,
    missingOptional: 0,
    incompatible: 0,
    unknownUnverifiable: 0,
  };

  for (const entry of entries) {
    switch (entry.status) {
      case ComfyRuntimeAssetValidationStatuses.presentValid:
        summary.presentValid += 1;
        break;
      case ComfyRuntimeAssetValidationStatuses.missingRequired:
        summary.missingRequired += 1;
        break;
      case ComfyRuntimeAssetValidationStatuses.missingOptional:
        summary.missingOptional += 1;
        break;
      case ComfyRuntimeAssetValidationStatuses.incompatible:
        summary.incompatible += 1;
        break;
      case ComfyRuntimeAssetValidationStatuses.unknownUnverifiable:
        summary.unknownUnverifiable += 1;
        break;
      default:
        break;
    }
  }

  return Object.freeze(summary);
}

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

