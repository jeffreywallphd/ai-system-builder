import { AssetDraftLifecycleStatuses, type AssetDraft } from "../../domain/studio-shell/StudioShellDomain";

export const StudioShellValidationSections = Object.freeze({
  taxonomy: "taxonomy",
  contract: "contract",
  provenance: "provenance",
  dependencies: "dependencies",
  lifecycle: "lifecycle",
  publishVersion: "publish-version",
});

export type StudioShellValidationSection =
  typeof StudioShellValidationSections[keyof typeof StudioShellValidationSections];

export const StudioShellValidationIssueCodes = Object.freeze({
  taxonomyMissing: "taxonomy-missing",
  contractMissing: "contract-missing",
  provenanceMissing: "provenance-missing",
  dependencyVersionNotFound: "dependency-version-not-found",
  dependencyVersionUnpinned: "dependency-version-unpinned",
  lifecycleNotPublishReady: "lifecycle-not-publish-ready",
  versionHistoryEmpty: "version-history-empty",
});

export type StudioShellValidationIssueCode =
  typeof StudioShellValidationIssueCodes[keyof typeof StudioShellValidationIssueCodes];

export interface StudioShellValidationIssue {
  readonly code: StudioShellValidationIssueCode;
  readonly section: StudioShellValidationSection;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly path?: string;
}

export async function buildStudioShellValidationIssues(input: {
  readonly draft: AssetDraft;
  readonly knownVersionIds: ReadonlyArray<string>;
  readonly versionExists: (versionId: string) => Promise<boolean>;
}): Promise<ReadonlyArray<StudioShellValidationIssue>> {
  const issues: StudioShellValidationIssue[] = [];

  if (!input.draft.metadata.taxonomy) {
    issues.push({
      code: StudioShellValidationIssueCodes.taxonomyMissing,
      section: StudioShellValidationSections.taxonomy,
      severity: "warning",
      message: "Draft taxonomy is missing. Add taxonomy to support downstream composition projection.",
    });
  }
  if (!input.draft.metadata.contract) {
    issues.push({
      code: StudioShellValidationIssueCodes.contractMissing,
      section: StudioShellValidationSections.contract,
      severity: "warning",
      message: "Draft contract is missing. Add contract metadata before publishing integrations.",
    });
  }
  if (!input.draft.metadata.provenance) {
    issues.push({
      code: StudioShellValidationIssueCodes.provenanceMissing,
      section: StudioShellValidationSections.provenance,
      severity: "warning",
      message: "Draft provenance is missing. Add creator/source context for lineage explainability.",
    });
  }

  for (const [index, dependency] of input.draft.dependencies.entries()) {
    if (!dependency.versionId) {
      issues.push({
        code: StudioShellValidationIssueCodes.dependencyVersionUnpinned,
        section: StudioShellValidationSections.dependencies,
        severity: "warning",
        message: `Dependency '${dependency.assetId}' is not pinned to a version.`,
        path: `dependencies[${index}]`,
      });
      continue;
    }
    const versionExists = input.knownVersionIds.includes(dependency.versionId)
      || await input.versionExists(dependency.versionId);
    if (!versionExists) {
      issues.push({
        code: StudioShellValidationIssueCodes.dependencyVersionNotFound,
        section: StudioShellValidationSections.dependencies,
        severity: "error",
        message: `Dependency version '${dependency.versionId}' was not found.`,
        path: `dependencies[${index}].versionId`,
      });
    }
  }

  if (
    input.draft.lifecycleStatus !== AssetDraftLifecycleStatuses.validated
    && input.draft.lifecycleStatus !== AssetDraftLifecycleStatuses.published
  ) {
    issues.push({
      code: StudioShellValidationIssueCodes.lifecycleNotPublishReady,
      section: StudioShellValidationSections.lifecycle,
      severity: "error",
      message: "Draft lifecycle must be 'validated' before publish/version operations.",
    });
  }

  if (input.draft.publishedVersionIds.length === 0) {
    issues.push({
      code: StudioShellValidationIssueCodes.versionHistoryEmpty,
      section: StudioShellValidationSections.publishVersion,
      severity: "warning",
      message: "No published versions exist yet for this draft.",
    });
  }

  return Object.freeze(issues);
}
