import { AssetDraftLifecycleStatuses, type AssetDraft } from "@domain/studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  type CompositionTaxonomyDescriptor,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type TaxonomySemanticRole,
} from "@domain/taxonomy/CompositionTaxonomy";

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
  dependencyAssetVersionMismatch: "dependency-asset-version-mismatch",
  compositeDependencySemanticRoleDisallowed: "composite-dependency-semantic-role-disallowed",
  compositeDependencyRecommended: "composite-dependency-recommended",
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
  readonly resolveDependencyVersion?: (versionId: string) => Promise<{ readonly assetId: string; readonly taxonomy?: CompositionTaxonomyDescriptor } | undefined>;
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


  const taxonomy = input.draft.metadata.taxonomy;
  if (
    taxonomy?.structuralKind === "composite"
    && input.draft.dependencies.length === 0
  ) {
    issues.push({
      code: StudioShellValidationIssueCodes.compositeDependencyRecommended,
      section: StudioShellValidationSections.dependencies,
      severity: "warning",
      message: "Composite drafts should reference at least one dependency to preserve composition intent and lineage traceability.",
      path: "dependencies",
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
      continue;
    }

    const resolvedVersion = await input.resolveDependencyVersion?.(dependency.versionId);
    if (resolvedVersion && resolvedVersion.assetId !== dependency.assetId) {
      issues.push({
        code: StudioShellValidationIssueCodes.dependencyAssetVersionMismatch,
        section: StudioShellValidationSections.dependencies,
        severity: "error",
        message: `Dependency '${dependency.assetId}' does not match version '${dependency.versionId}' asset '${resolvedVersion.assetId}'.`,
        path: `dependencies[${index}]`,
      });
      continue;
    }

    if (resolvedVersion?.taxonomy && !isDependencyTaxonomyAllowed(input.draft, resolvedVersion.taxonomy)) {
      issues.push({
        code: StudioShellValidationIssueCodes.compositeDependencySemanticRoleDisallowed,
        section: StudioShellValidationSections.dependencies,
        severity: "error",
        message: `Draft semantic role '${taxonomy?.semanticRole}' does not allow dependency taxonomy '${resolvedVersion.taxonomy.structuralKind}/${resolvedVersion.taxonomy.semanticRole}/${resolvedVersion.taxonomy.behaviorKind}'.`,
        path: `dependencies[${index}]`,
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

function isDependencyTaxonomyAllowed(
  draft: AssetDraft,
  dependencyTaxonomy: CompositionTaxonomyDescriptor,
): boolean {
  const taxonomy = draft.metadata.taxonomy;
  if (!taxonomy || (taxonomy.structuralKind !== TaxonomyStructuralKinds.composite && taxonomy.structuralKind !== TaxonomyStructuralKinds.system)) {
    return true;
  }

  const allowed = allowedDependencyRolesByCompositeRole[taxonomy.semanticRole];
  if (!allowed) {
    return true;
  }

  return allowed.has(dependencyTaxonomy.semanticRole);
}

export function isDependencySemanticRoleAllowedForCompositeRole(
  compositeRole: TaxonomySemanticRole,
  dependencyRole: TaxonomySemanticRole,
): boolean {
  const allowed = allowedDependencyRolesByCompositeRole[compositeRole];
  if (!allowed) {
    return true;
  }

  return allowed.has(dependencyRole);
}

const allowedDependencyRolesByCompositeRole: Readonly<
  Partial<Record<TaxonomySemanticRole, ReadonlySet<TaxonomySemanticRole>>>
> = Object.freeze({
  [TaxonomySemanticRoles.workflow]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.model,
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.tool,
    TaxonomySemanticRoles.promptTemplate,
    TaxonomySemanticRoles.embeddingIndex,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.contextBundle,
    TaxonomySemanticRoles.datasetPipeline,
    TaxonomySemanticRoles.trainingRecipe,
    TaxonomySemanticRoles.toolChain,
    TaxonomySemanticRoles.workflow,
  ]),
  [TaxonomySemanticRoles.contextBundle]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.promptTemplate,
    TaxonomySemanticRoles.embeddingIndex,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.contextBundle,
  ]),
  [TaxonomySemanticRoles.datasetPipeline]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.tool,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.contextBundle,
    TaxonomySemanticRoles.datasetPipeline,
  ]),
  [TaxonomySemanticRoles.trainingRecipe]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.model,
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.datasetPipeline,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.trainingRecipe,
  ]),
  [TaxonomySemanticRoles.toolChain]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.tool,
    TaxonomySemanticRoles.promptTemplate,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.toolChain,
  ]),
  [TaxonomySemanticRoles.system]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.model,
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.tool,
    TaxonomySemanticRoles.promptTemplate,
    TaxonomySemanticRoles.embeddingIndex,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.workflow,
    TaxonomySemanticRoles.contextBundle,
    TaxonomySemanticRoles.datasetPipeline,
    TaxonomySemanticRoles.trainingRecipe,
    TaxonomySemanticRoles.toolChain,
    TaxonomySemanticRoles.appTemplate,
    TaxonomySemanticRoles.system,
  ]),
  [TaxonomySemanticRoles.appTemplate]: new Set<TaxonomySemanticRole>([
    TaxonomySemanticRoles.model,
    TaxonomySemanticRoles.dataset,
    TaxonomySemanticRoles.tool,
    TaxonomySemanticRoles.promptTemplate,
    TaxonomySemanticRoles.embeddingIndex,
    TaxonomySemanticRoles.configProfile,
    TaxonomySemanticRoles.workflow,
    TaxonomySemanticRoles.contextBundle,
    TaxonomySemanticRoles.datasetPipeline,
    TaxonomySemanticRoles.trainingRecipe,
    TaxonomySemanticRoles.toolChain,
    TaxonomySemanticRoles.appTemplate,
    TaxonomySemanticRoles.system,
  ]),
});

export function tryReadTaxonomyFromVersionMetadata(metadata: unknown): CompositionTaxonomyDescriptor | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const root = metadata as { readonly metadata?: unknown };
  if (!root.metadata || typeof root.metadata !== "object") {
    return undefined;
  }
  const nested = root.metadata as { readonly taxonomy?: unknown };
  if (!nested.taxonomy || typeof nested.taxonomy !== "object") {
    return undefined;
  }

  const snapshot = nested.taxonomy as {
    readonly structuralKind?: CompositionTaxonomyDescriptor["structuralKind"];
    readonly semanticRole?: CompositionTaxonomyDescriptor["semanticRole"];
    readonly behaviorKind?: CompositionTaxonomyDescriptor["behaviorKind"];
  };
  if (!snapshot.structuralKind || !snapshot.semanticRole || !snapshot.behaviorKind) {
    return undefined;
  }

  try {
    return createCompositionTaxonomyDescriptor(snapshot);
  } catch {
    return undefined;
  }
}

