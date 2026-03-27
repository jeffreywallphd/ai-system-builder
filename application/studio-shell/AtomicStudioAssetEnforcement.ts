import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { AssetDraft } from "../../domain/studio-shell/StudioShellDomain";
import type { CompositionTaxonomyDescriptor, TaxonomyBehaviorKind, TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";
import { TaxonomyStructuralKinds } from "../../domain/taxonomy/CompositionTaxonomy";
import { StudioShellInvalidRequestError } from "./StudioShellApplicationErrors";

export const AtomicStudioEnforcementIssueCodes = Object.freeze({
  taxonomyMissing: "taxonomy-missing",
  taxonomyStructuralKindMismatch: "taxonomy-structural-kind-mismatch",
  taxonomySemanticRoleMismatch: "taxonomy-semantic-role-mismatch",
  taxonomyBehaviorKindMismatch: "taxonomy-behavior-kind-mismatch",
  contractMissing: "contract-missing",
  contractNotDerivable: "contract-not-derivable",
  contractMismatch: "contract-mismatch",
});

export type AtomicStudioEnforcementIssueCode =
  typeof AtomicStudioEnforcementIssueCodes[keyof typeof AtomicStudioEnforcementIssueCodes];

export interface AtomicStudioEnforcementIssue {
  readonly code: AtomicStudioEnforcementIssueCode;
  readonly message: string;
}

export interface AtomicStudioExpectation {
  readonly studioType: string;
  readonly semanticRole: TaxonomySemanticRole;
  readonly allowedBehaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
}

function sameContractShape(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function evaluateAtomicStudioDraftConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: AtomicStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): ReadonlyArray<AtomicStudioEnforcementIssue> {
  const { draft, expectation, contractResolver } = input;
  const issues: AtomicStudioEnforcementIssue[] = [];
  const taxonomy = draft.metadata.taxonomy;

  if (!taxonomy) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.taxonomyMissing,
      message: `Draft '${draft.id}' in '${expectation.studioType}' is missing taxonomy metadata.`,
    });
    return Object.freeze(issues);
  }

  issues.push(...validateTaxonomyForExpectation(taxonomy, expectation));

  if (!draft.metadata.contract) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.contractMissing,
      message: `Draft '${draft.id}' in '${expectation.studioType}' is missing contract metadata.`,
    });
    return Object.freeze(issues);
  }

  const expectedContract = contractResolver.resolveContractForTaxonomy(taxonomy);
  if (!expectedContract) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.contractNotDerivable,
      message: `Draft '${draft.id}' has taxonomy '${taxonomy.structuralKind}/${taxonomy.semanticRole}/${taxonomy.behaviorKind}' with no shared contract projection.`,
    });
    return Object.freeze(issues);
  }

  if (!sameContractShape(expectedContract, draft.metadata.contract)) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.contractMismatch,
      message: `Draft '${draft.id}' contract does not match the shared taxonomy-driven contract projection.`,
    });
  }

  return Object.freeze(issues);
}

function validateTaxonomyForExpectation(
  taxonomy: CompositionTaxonomyDescriptor,
  expectation: AtomicStudioExpectation,
): ReadonlyArray<AtomicStudioEnforcementIssue> {
  const issues: AtomicStudioEnforcementIssue[] = [];
  if (taxonomy.structuralKind !== TaxonomyStructuralKinds.atomic) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.taxonomyStructuralKindMismatch,
      message: `Atomic studio '${expectation.studioType}' requires structural kind 'atomic'. Received '${taxonomy.structuralKind}'.`,
    });
  }

  if (taxonomy.semanticRole !== expectation.semanticRole) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.taxonomySemanticRoleMismatch,
      message: `Atomic studio '${expectation.studioType}' requires semantic role '${expectation.semanticRole}'. Received '${taxonomy.semanticRole}'.`,
    });
  }

  if (!expectation.allowedBehaviorKinds.includes(taxonomy.behaviorKind)) {
    issues.push({
      code: AtomicStudioEnforcementIssueCodes.taxonomyBehaviorKindMismatch,
      message: `Atomic studio '${expectation.studioType}' requires behavior kind in [${expectation.allowedBehaviorKinds.join(", ")}]. Received '${taxonomy.behaviorKind}'.`,
    });
  }

  return Object.freeze(issues);
}

export function assertAtomicStudioDraftPublishConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: AtomicStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy">;
}): void {
  const issues = evaluateAtomicStudioDraftConsistency(input);
  if (issues.length === 0) {
    return;
  }

  throw new StudioShellInvalidRequestError(
    `Atomic studio draft enforcement failed for '${input.expectation.studioType}': ${issues.map((issue) => `${issue.code}: ${issue.message}`).join(" ")}`,
  );
}
