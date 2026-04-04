import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ComfyRuntimeAssetValidationStatuses,
  createComfyRuntimeAssetRequirement,
  createComfyRuntimeAssetValidationResult,
  resolveComfyRuntimeAssetRequirementDirectory,
  resolveComfyRuntimeAssetRequirementsForProfile,
  type ComfyRuntimeAssetRequirement,
  type ComfyRuntimeAssetValidationEntry,
  type ComfyRuntimeAssetValidationIssue,
} from "../../application/runtime/ComfyRuntimeRequirements";
import type {
  IComfyRuntimeModelValidationHook,
  ComfyRuntimeOrchestrationContext,
  ComfyRuntimeOrchestrationIssue,
  ComfyRuntimeOrchestrationPhaseHookResult,
} from "../../application/runtime/ComfyRuntimeInstallerOrchestrationService";

export interface ComfyRuntimeAssetValidationHookOptions {
  readonly now?: () => Date;
}

export class ComfyRuntimeAssetValidationHook implements IComfyRuntimeModelValidationHook {
  private readonly now: () => Date;

  public constructor(options: ComfyRuntimeAssetValidationHookOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  public async validateModels(context: ComfyRuntimeOrchestrationContext): Promise<ComfyRuntimeOrchestrationPhaseHookResult> {
    const selectedRequirements = resolveComfyRuntimeAssetRequirementsForProfile({
      requirements: context.runtimeAsset.runtimeAssetRequirements,
      workflowProfile: context.workflowProfile,
    });
    if (selectedRequirements.length < 1) {
      return Object.freeze({
        status: "skipped",
        message: "No runtime asset validation requirements were declared.",
        issues: Object.freeze([]),
        metadata: Object.freeze({
          modelValidation: Object.freeze({
            workflowProfile: context.workflowProfile,
            result: createComfyRuntimeAssetValidationResult({
              workflowProfile: context.workflowProfile,
              entries: Object.freeze([]),
            }),
            generatedAt: this.now().toISOString(),
          }),
        }),
      });
    }

    const entries = selectedRequirements.map((requirement) => this.validateRequirement(context, requirement));
    const result = createComfyRuntimeAssetValidationResult({
      workflowProfile: context.workflowProfile,
      entries,
    });
    const phaseIssues = entries.flatMap((entry) => entry.issues.map((issue) => mapIssueToPhase(entry, issue)));
    const status = result.valid ? "completed" : "failed";
    return Object.freeze({
      status,
      message: `Runtime asset validation resolved ${result.summary.total} requirement(s) for '${context.workflowProfile}' profile.`,
      issues: Object.freeze(phaseIssues),
      metadata: Object.freeze({
        modelValidation: Object.freeze({
          workflowProfile: context.workflowProfile,
          result,
          generatedAt: this.now().toISOString(),
        }),
      }),
    });
  }

  private validateRequirement(
    context: ComfyRuntimeOrchestrationContext,
    requirementInput: ComfyRuntimeAssetRequirement,
  ): ComfyRuntimeAssetValidationEntry {
    const requirement = createComfyRuntimeAssetRequirement(requirementInput);
    const inspectedDirectory = resolveComfyRuntimeAssetRequirementDirectory({
      installDirectory: context.installDirectory,
      requirement,
    });
    if (!existsSync(inspectedDirectory)) {
      return createMissingEntry(requirement, inspectedDirectory, "runtime-asset-directory-missing");
    }
    if (!statSync(inspectedDirectory).isDirectory()) {
      return createIncompatibleEntry(requirement, inspectedDirectory, "runtime-asset-directory-invalid");
    }

    let fileNames: string[] = [];
    try {
      fileNames = readdirSync(inspectedDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch {
      return createUnknownEntry(requirement, inspectedDirectory, "runtime-asset-directory-unverifiable");
    }

    if (requirement.compatibilityCheck === "directory-presence") {
      if (fileNames.length < requirement.minimumFileCount) {
        return createMissingEntry(requirement, inspectedDirectory, "runtime-asset-count-insufficient");
      }
      return createPresentEntry(requirement, inspectedDirectory, undefined, undefined, [
        createLimitationIssue(requirement),
      ]);
    }

    const expectedNames = requirement.candidateFileNames.map((entry) => entry.toLowerCase());
    const configured = requirement.configuredModelName?.trim() ?? "";
    const normalizedConfigured = configured.toLowerCase();
    if (normalizedConfigured && normalizedConfigured !== "system-default") {
      expectedNames.push(normalizedConfigured);
      for (const extension of requirement.allowedExtensions) {
        expectedNames.push(`${normalizedConfigured}${extension}`);
      }
    }
    const uniqueExpectedNames = [...new Set(expectedNames)];
    const filesByLower = new Map(fileNames.map((entry) => [entry.toLowerCase(), entry] as const));

    for (const expectedName of uniqueExpectedNames) {
      const matched = filesByLower.get(expectedName);
      if (!matched) {
        continue;
      }
      const extension = path.extname(matched).toLowerCase();
      if (requirement.allowedExtensions.length > 0 && !requirement.allowedExtensions.includes(extension)) {
        return createIncompatibleEntry(requirement, inspectedDirectory, "runtime-asset-extension-incompatible", {
          resolvedFileName: matched,
          resolvedPath: path.join(inspectedDirectory, matched),
        });
      }
      return createPresentEntry(requirement, inspectedDirectory, matched, path.join(inspectedDirectory, matched), [
        createLimitationIssue(requirement),
      ]);
    }

    const allowed = requirement.allowedExtensions;
    const extensionMatches = fileNames.filter((entry) => (
      allowed.length < 1 || allowed.includes(path.extname(entry).toLowerCase())
    ));
    if (extensionMatches.length >= requirement.minimumFileCount) {
      const selected = extensionMatches[0];
      const selectedPath = selected ? path.join(inspectedDirectory, selected) : undefined;
      return createPresentEntry(requirement, inspectedDirectory, selected, selectedPath, [
        createLimitationIssue(requirement),
      ]);
    }
    if (fileNames.length >= requirement.minimumFileCount && allowed.length > 0) {
      return createIncompatibleEntry(requirement, inspectedDirectory, "runtime-asset-extension-incompatible");
    }
    return createMissingEntry(requirement, inspectedDirectory, "runtime-asset-missing");
  }
}

function createPresentEntry(
  requirement: ComfyRuntimeAssetRequirement,
  inspectedDirectory: string,
  resolvedFileName?: string,
  resolvedPath?: string,
  additionalIssues?: ReadonlyArray<ComfyRuntimeAssetValidationIssue | undefined>,
): ComfyRuntimeAssetValidationEntry {
  const issues: ComfyRuntimeAssetValidationIssue[] = [];
  for (const issue of additionalIssues ?? []) {
    if (!issue) {
      continue;
    }
    issues.push(issue);
  }
  const hasLimitation = issues.some((entry) => entry.code === "compatibility-check-limited");
  return Object.freeze({
    requirementId: requirement.requirementId,
    kind: requirement.kind,
    displayName: requirement.displayName,
    required: requirement.required,
    applicability: requirement.applicability,
    status: hasLimitation
      ? ComfyRuntimeAssetValidationStatuses.unknownUnverifiable
      : ComfyRuntimeAssetValidationStatuses.presentValid,
    inspectedDirectory,
    resolvedFileName,
    resolvedPath,
    issues: Object.freeze(issues),
    metadata: Object.freeze({ ...requirement.metadata }),
  });
}

function createMissingEntry(
  requirement: ComfyRuntimeAssetRequirement,
  inspectedDirectory: string,
  code: string,
): ComfyRuntimeAssetValidationEntry {
  const missingStatus = requirement.required
    ? ComfyRuntimeAssetValidationStatuses.missingRequired
    : ComfyRuntimeAssetValidationStatuses.missingOptional;
  return Object.freeze({
    requirementId: requirement.requirementId,
    kind: requirement.kind,
    displayName: requirement.displayName,
    required: requirement.required,
    applicability: requirement.applicability,
    status: missingStatus,
    inspectedDirectory,
    issues: Object.freeze([Object.freeze({
      code,
      severity: requirement.required ? "error" : "warning",
      message: requirement.required
        ? `Required runtime asset '${requirement.displayName}' is missing.`
        : `Optional runtime asset '${requirement.displayName}' is missing.`,
      metadata: Object.freeze({ ...requirement.metadata }),
    })]),
    metadata: Object.freeze({ ...requirement.metadata }),
  });
}

function createIncompatibleEntry(
  requirement: ComfyRuntimeAssetRequirement,
  inspectedDirectory: string,
  code: string,
  extra: { readonly resolvedFileName?: string; readonly resolvedPath?: string } = {},
): ComfyRuntimeAssetValidationEntry {
  return Object.freeze({
    requirementId: requirement.requirementId,
    kind: requirement.kind,
    displayName: requirement.displayName,
    required: requirement.required,
    applicability: requirement.applicability,
    status: ComfyRuntimeAssetValidationStatuses.incompatible,
    inspectedDirectory,
    resolvedFileName: extra.resolvedFileName,
    resolvedPath: extra.resolvedPath,
    issues: Object.freeze([Object.freeze({
      code,
      severity: "error",
      message: `Runtime asset '${requirement.displayName}' is incompatible with declared requirements.`,
      metadata: Object.freeze({ ...requirement.metadata }),
    })]),
    metadata: Object.freeze({ ...requirement.metadata }),
  });
}

function createUnknownEntry(
  requirement: ComfyRuntimeAssetRequirement,
  inspectedDirectory: string,
  code: string,
): ComfyRuntimeAssetValidationEntry {
  return Object.freeze({
    requirementId: requirement.requirementId,
    kind: requirement.kind,
    displayName: requirement.displayName,
    required: requirement.required,
    applicability: requirement.applicability,
    status: ComfyRuntimeAssetValidationStatuses.unknownUnverifiable,
    inspectedDirectory,
    issues: Object.freeze([Object.freeze({
      code,
      severity: "warning",
      message: `Runtime asset '${requirement.displayName}' could not be verified.`,
      metadata: Object.freeze({ ...requirement.metadata }),
    })]),
    metadata: Object.freeze({ ...requirement.metadata }),
  });
}

function createLimitationIssue(
  requirement: ComfyRuntimeAssetRequirement,
): ComfyRuntimeAssetValidationIssue | undefined {
  const limitation = requirement.compatibilityCheckLimitations?.trim();
  if (!limitation) {
    return undefined;
  }
  return Object.freeze({
    code: "compatibility-check-limited",
    severity: "warning",
    message: limitation,
    metadata: Object.freeze({ ...requirement.metadata }),
  });
}

function mapIssueToPhase(
  entry: ComfyRuntimeAssetValidationEntry,
  issue: ComfyRuntimeAssetValidationIssue,
): ComfyRuntimeOrchestrationIssue {
  return Object.freeze({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    phase: "model-validation",
    metadata: Object.freeze({
      requirementId: entry.requirementId,
      requirementKind: entry.kind,
      ...issue.metadata,
    }),
  });
}
