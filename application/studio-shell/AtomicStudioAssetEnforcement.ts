import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { AssetDraft } from "../../domain/studio-shell/StudioShellDomain";
import type {
  CompositionTaxonomyDescriptor,
  TaxonomyBehaviorKind,
  TaxonomySemanticRole,
  TaxonomyStructuralKind,
} from "../../domain/taxonomy/CompositionTaxonomy";
import { TaxonomyStructuralKinds } from "../../domain/taxonomy/CompositionTaxonomy";
import { StudioShellInvalidRequestError } from "./StudioShellApplicationErrors";

export const StudioAssetEnforcementIssueCodes = Object.freeze({
  taxonomyMissing: "taxonomy-missing",
  taxonomyStructuralKindMismatch: "taxonomy-structural-kind-mismatch",
  taxonomySemanticRoleMismatch: "taxonomy-semantic-role-mismatch",
  taxonomyBehaviorKindMismatch: "taxonomy-behavior-kind-mismatch",
  contractMissing: "contract-missing",
  contractNotDerivable: "contract-not-derivable",
  contractMismatch: "contract-mismatch",
  compositeDependencyRequired: "composite-dependency-required",
  dependencyVersionUnpinned: "dependency-version-unpinned",
});

export type StudioAssetEnforcementIssueCode =
  typeof StudioAssetEnforcementIssueCodes[keyof typeof StudioAssetEnforcementIssueCodes];

export interface StudioAssetEnforcementIssue {
  readonly code: StudioAssetEnforcementIssueCode;
  readonly message: string;
}

export interface StudioAssetExpectation {
  readonly studioType: string;
  readonly structuralKind: TaxonomyStructuralKind;
  readonly semanticRole: TaxonomySemanticRole;
  readonly allowedBehaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
  readonly requireDerivableContract?: boolean;
}

export interface AtomicStudioExpectation {
  readonly studioType: string;
  readonly semanticRole: TaxonomySemanticRole;
  readonly allowedBehaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
}

export interface CompositeStudioExpectation {
  readonly studioType: string;
  readonly semanticRole: TaxonomySemanticRole;
  readonly allowedBehaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
  readonly requireDerivableContract?: boolean;
}

function sameContractShape(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function evaluateStudioDraftConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: StudioAssetExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): ReadonlyArray<StudioAssetEnforcementIssue> {
  const { draft, expectation, contractResolver } = input;
  const issues: StudioAssetEnforcementIssue[] = [];
  const taxonomy = draft.metadata.taxonomy;

  if (!taxonomy) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.taxonomyMissing,
      message: `Draft '${draft.id}' in '${expectation.studioType}' is missing taxonomy metadata.`,
    });
    return Object.freeze(issues);
  }

  issues.push(...validateTaxonomyForExpectation(taxonomy, expectation));

  if (!draft.metadata.contract) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.contractMissing,
      message: `Draft '${draft.id}' in '${expectation.studioType}' is missing contract metadata.`,
    });
    return Object.freeze(issues);
  }

  const expectedContract = contractResolver.resolveContractForTaxonomy(taxonomy);
  const requireDerivableContract = expectation.requireDerivableContract
    ?? expectation.structuralKind !== TaxonomyStructuralKinds.system;

  if (!expectedContract && requireDerivableContract) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.contractNotDerivable,
      message: `Draft '${draft.id}' has taxonomy '${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}' with no shared contract projection.`,
    });
    return Object.freeze(issues);
  }

  if (expectedContract && !sameContractShape(expectedContract, draft.metadata.contract)) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.contractMismatch,
      message: `Draft '${draft.id}' contract does not match the shared taxonomy-driven contract projection.`,
    });
  }

  return Object.freeze(issues);
}

function validateTaxonomyForExpectation(
  taxonomy: CompositionTaxonomyDescriptor,
  expectation: StudioAssetExpectation,
): ReadonlyArray<StudioAssetEnforcementIssue> {
  const issues: StudioAssetEnforcementIssue[] = [];
  if (taxonomy.structuralKind !== expectation.structuralKind) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.taxonomyStructuralKindMismatch,
      message: `Studio '${expectation.studioType}' requires structural kind '${expectation.structuralKind}'. Received '${taxonomy.structuralKind}'.`,
    });
  }

  if (taxonomy.semanticRole !== expectation.semanticRole) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.taxonomySemanticRoleMismatch,
      message: `Studio '${expectation.studioType}' requires semantic role '${expectation.semanticRole}'. Received '${taxonomy.semanticRole}'.`,
    });
  }

  if (!expectation.allowedBehaviorKinds.includes(taxonomy.behaviorKind)) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.taxonomyBehaviorKindMismatch,
      message: `Studio '${expectation.studioType}' requires behavior kind in [${expectation.allowedBehaviorKinds.join(", ")}]. Received '${taxonomy.behaviorKind}'.`,
    });
  }

  return Object.freeze(issues);
}

export function assertStudioDraftPublishConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: StudioAssetExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): void {
  const issues = evaluateStudioDraftConsistency(input);
  if (issues.length === 0) {
    return;
  }

  throw new StudioShellInvalidRequestError(
    `Studio draft enforcement failed for '${input.expectation.studioType}': ${issues.map((issue) => `${issue.code}: ${issue.message}`).join(" ")}`,
  );
}

export const AtomicStudioEnforcementIssueCodes = StudioAssetEnforcementIssueCodes;
export type AtomicStudioEnforcementIssueCode = StudioAssetEnforcementIssueCode;
export type AtomicStudioEnforcementIssue = StudioAssetEnforcementIssue;

export function evaluateAtomicStudioDraftConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: AtomicStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): ReadonlyArray<AtomicStudioEnforcementIssue> {
  return evaluateStudioDraftConsistency({
    ...input,
    expectation: {
      ...input.expectation,
      structuralKind: TaxonomyStructuralKinds.atomic,
    },
  });
}

export function assertAtomicStudioDraftPublishConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: AtomicStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): void {
  assertStudioDraftPublishConsistency({
    ...input,
    expectation: {
      ...input.expectation,
      structuralKind: TaxonomyStructuralKinds.atomic,
    },
  });
}

export function evaluateCompositeStudioDraftConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: CompositeStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): ReadonlyArray<StudioAssetEnforcementIssue> {
  const issues = [...evaluateStudioDraftConsistency({
    ...input,
    expectation: {
      ...input.expectation,
      structuralKind: TaxonomyStructuralKinds.composite,
      requireDerivableContract: input.expectation.requireDerivableContract ?? true,
    },
  })];

  if (input.draft.dependencies.length === 0) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.compositeDependencyRequired,
      message: `Composite studio '${input.expectation.studioType}' draft '${input.draft.id}' must include at least one dependency reference.`,
    });
  }

  for (const dependency of input.draft.dependencies) {
    if (!dependency.versionId) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.dependencyVersionUnpinned,
        message: `Composite studio '${input.expectation.studioType}' draft '${input.draft.id}' dependency '${dependency.assetId}' must be pinned to a version.`,
      });
    }
  }

  return Object.freeze(issues);
}

export function assertCompositeStudioDraftPublishConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: CompositeStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): void {
  const issues = evaluateCompositeStudioDraftConsistency(input);
  if (issues.length === 0) {
    return;
  }

  throw new StudioShellInvalidRequestError(
    `Studio draft enforcement failed for '${input.expectation.studioType}': ${issues.map((issue) => `${issue.code}: ${issue.message}`).join(" ")}`,
  );
}
