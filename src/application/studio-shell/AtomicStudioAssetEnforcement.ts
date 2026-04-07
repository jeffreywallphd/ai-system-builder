import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { AssetDraft } from "../../domain/studio-shell/StudioShellDomain";
import type {
  CompositionTaxonomyDescriptor,
  TaxonomyBehaviorKind,
  TaxonomySemanticRole,
  TaxonomyStructuralKind,
} from "../../domain/taxonomy/CompositionTaxonomy";
import { TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../domain/taxonomy/CompositionTaxonomy";
import { StudioShellInvalidRequestError } from "./StudioShellApplicationErrors";
import {
  buildNestedSystemReferences,
  type SystemAsset,
  type SystemBindingEndpoint,
  type SystemComponentReference,
  SystemBindingEndpointScopes,
  SystemComponentKinds,
  type SystemCompositionReference,
} from "../../domain/system-studio/SystemAssetDomain";

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
  systemChildVersionUnpinned: "system-child-version-unpinned",
  systemChildReferenceMissing: "system-child-reference-missing",
  systemBindingEndpointNotFound: "system-binding-endpoint-not-found",
  systemBindingTypeMismatch: "system-binding-type-mismatch",
  systemRecursionCycleDetected: "system-recursion-cycle-detected",
  systemRecursionDepthExceeded: "system-recursion-depth-exceeded",
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

export interface SystemStudioExpectation {
  readonly studioType: string;
  readonly semanticRole: Extract<TaxonomySemanticRole, "system" | "app-template">;
  readonly allowedBehaviorKinds: ReadonlyArray<TaxonomyBehaviorKind>;
  readonly requireDerivableContract?: boolean;
}

interface SystemBindingEndpointValidation {
  readonly exists: boolean;
  readonly valueType?: string;
}

function requiresPinnedComponentVersion(input: {
  readonly component: SystemComponentReference;
  readonly resolvedContract?: AssetDraft["metadata"]["contract"];
}): boolean {
  if (input.component.versionId) {
    return false;
  }

  if (input.component.componentKind === SystemComponentKinds.system) {
    return true;
  }

  const semanticRole = input.component.taxonomy?.semanticRole;
  if (
    semanticRole === TaxonomySemanticRoles.workflow
    || semanticRole === TaxonomySemanticRoles.workflowTemplate
    || semanticRole === TaxonomySemanticRoles.system
    || semanticRole === TaxonomySemanticRoles.appTemplate
  ) {
    return true;
  }

  if (!semanticRole) {
    return true;
  }

  return !input.resolvedContract;
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
    const allowMissingSystemContract = expectation.structuralKind === TaxonomyStructuralKinds.system
      && (expectation.requireDerivableContract ?? false) === false;
    if (!allowMissingSystemContract) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.contractMissing,
        message: `Draft '${draft.id}' in '${expectation.studioType}' is missing contract metadata.`,
      });
      return Object.freeze(issues);
    }
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

  if (expectedContract && draft.metadata.contract && !sameContractShape(expectedContract, draft.metadata.contract)) {
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

function inferInputValueType(contract: AssetDraft["metadata"]["contract"], endpointId: string): string | undefined {
  const schema = contract?.input?.schema as { readonly properties?: Record<string, { readonly type?: string }> } | undefined;
  return schema?.properties?.[endpointId]?.type;
}

function inferOutputValueType(contract: AssetDraft["metadata"]["contract"], endpointId: string): string | undefined {
  const schema = contract?.output?.schema as { readonly properties?: Record<string, { readonly type?: string }> } | undefined;
  return schema?.properties?.[endpointId]?.type;
}

function resolveSystemBindingEndpoint(input: {
  readonly endpoint: SystemBindingEndpoint;
  readonly system: SystemAsset;
  readonly componentContractsByAlias: ReadonlyMap<string, AssetDraft["metadata"]["contract"] | undefined>;
}): SystemBindingEndpointValidation {
  if (input.endpoint.scope === SystemBindingEndpointScopes.systemInput) {
    const found = input.system.inputs.find((entry) => entry.inputId === input.endpoint.endpointId);
    return { exists: Boolean(found), valueType: found?.valueType };
  }
  if (input.endpoint.scope === SystemBindingEndpointScopes.systemOutput) {
    const found = input.system.outputs.find((entry) => entry.outputId === input.endpoint.endpointId);
    return { exists: Boolean(found), valueType: found?.valueType };
  }
  if (input.endpoint.scope === SystemBindingEndpointScopes.systemParameter) {
    const found = input.system.parameters.find((entry) => entry.parameterId === input.endpoint.endpointId);
    return { exists: Boolean(found), valueType: found?.valueType };
  }

  const alias = input.endpoint.componentAlias ?? "";
  const contract = input.componentContractsByAlias.get(alias);
  if (!contract) {
    return { exists: false };
  }

  if (input.endpoint.scope === SystemBindingEndpointScopes.componentInput) {
    const schema = contract.input?.schema as { readonly properties?: Record<string, { readonly type?: string }> } | undefined;
    const property = schema?.properties?.[input.endpoint.endpointId];
    return { exists: Boolean(property), valueType: inferInputValueType(contract, input.endpoint.endpointId) };
  }
  if (input.endpoint.scope === SystemBindingEndpointScopes.componentOutput) {
    const schema = contract.output?.schema as { readonly properties?: Record<string, { readonly type?: string }> } | undefined;
    const property = schema?.properties?.[input.endpoint.endpointId];
    return { exists: Boolean(property), valueType: inferOutputValueType(contract, input.endpoint.endpointId) };
  }

  const parameter = contract.parameters.find((entry) => entry.id === input.endpoint.endpointId);
  return { exists: Boolean(parameter), valueType: parameter?.valueType };
}

export async function evaluateSystemStudioDraftConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: SystemStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy" | "resolveSystemContract">;
  readonly systemAsset: SystemAsset;
  readonly resolveSystem: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined> | SystemAsset | undefined;
  readonly resolveChildContract?: (component: SystemComponentReference) => Promise<AssetDraft["metadata"]["contract"] | undefined> | AssetDraft["metadata"]["contract"] | undefined;
  readonly maxDepth?: number;
}): Promise<ReadonlyArray<StudioAssetEnforcementIssue>> {
  const issues = [...evaluateStudioDraftConsistency({
    ...input,
    expectation: {
      ...input.expectation,
      structuralKind: TaxonomyStructuralKinds.system,
      requireDerivableContract: input.expectation.requireDerivableContract ?? false,
    },
  }).filter((issue) => issue.code !== StudioAssetEnforcementIssueCodes.contractMismatch)];

  const componentContractsByAlias = new Map<string, AssetDraft["metadata"]["contract"] | undefined>();
  for (const component of input.systemAsset.components) {
    if (!component.alias) {
      continue;
    }
    const resolvedContract = input.resolveChildContract
      ? await input.resolveChildContract(component)
      : (component.taxonomy ? input.contractResolver.resolveContractForTaxonomy(component.taxonomy) : undefined);
    if (requiresPinnedComponentVersion({ component, resolvedContract })) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemChildVersionUnpinned,
        message: `System draft '${input.draft.id}' child '${component.assetId}' must be pinned to a version.`,
      });
    }
    if (!resolvedContract) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemChildReferenceMissing,
        message: `System draft '${input.draft.id}' child '${component.assetId}' does not have a resolvable contract.`,
      });
    }
    componentContractsByAlias.set(component.alias, resolvedContract);
  }

  for (const reference of buildNestedSystemReferences(input.systemAsset)) {
    if (!reference.versionId) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemChildVersionUnpinned,
        message: `System draft '${input.draft.id}' nested system '${reference.assetId}' must be pinned to a version.`,
      });
    }

    const child = await input.resolveSystem(reference);
    if (!child) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemChildReferenceMissing,
        message: `System draft '${input.draft.id}' nested system '${reference.assetId}' could not be resolved.`,
      });
    }
  }

  for (const binding of input.systemAsset.bindings) {
    const source = resolveSystemBindingEndpoint({
      endpoint: binding.source,
      system: input.systemAsset,
      componentContractsByAlias,
    });
    const target = resolveSystemBindingEndpoint({
      endpoint: binding.target,
      system: input.systemAsset,
      componentContractsByAlias,
    });

    if (!source.exists || !target.exists) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemBindingEndpointNotFound,
        message: `System binding '${binding.bindingId}' references unresolved endpoint(s).`,
      });
      continue;
    }

    if (source.valueType && target.valueType && source.valueType !== target.valueType) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemBindingTypeMismatch,
        message: `System binding '${binding.bindingId}' has incompatible endpoint types '${source.valueType}' -> '${target.valueType}'.`,
      });
    }
  }

  const maxDepth = Math.max(1, input.maxDepth ?? 4);
  const visited = new Set<string>();
  const traverse = async (system: SystemAsset, path: ReadonlyArray<string>, depth: number): Promise<void> => {
    const key = `${system.assetId}::${system.versionId ?? ""}`;
    if (path.includes(key)) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemRecursionCycleDetected,
        message: `System draft '${input.draft.id}' recursion cycle detected at '${system.assetId}'.`,
      });
      return;
    }
    if (depth > maxDepth) {
      issues.push({
        code: StudioAssetEnforcementIssueCodes.systemRecursionDepthExceeded,
        message: `System draft '${input.draft.id}' recursion depth exceeds max depth ${maxDepth}.`,
      });
      return;
    }

    visited.add(key);
    for (const reference of buildNestedSystemReferences(system)) {
      const child = await input.resolveSystem(reference);
      if (!child) {
        continue;
      }
      await traverse(child, [...path, key], depth + 1);
    }
  };
  await traverse(input.systemAsset, [], 1);

  const projectedContract = await input.contractResolver.resolveSystemContract({
    root: input.systemAsset,
    resolveSystem: input.resolveSystem,
    resolveChildContract: input.resolveChildContract,
    maxDepth,
  });
  if (input.draft.metadata.contract && JSON.stringify(projectedContract) !== JSON.stringify(input.draft.metadata.contract)) {
    issues.push({
      code: StudioAssetEnforcementIssueCodes.contractMismatch,
      message: `System draft '${input.draft.id}' contract does not match recursive system contract projection.`,
    });
  }

  return Object.freeze(issues);
}

export async function assertSystemStudioDraftPublishConsistency(input: {
  readonly draft: AssetDraft;
  readonly expectation: SystemStudioExpectation;
  readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy" | "resolveSystemContract">;
  readonly systemAsset: SystemAsset;
  readonly resolveSystem: (reference: SystemCompositionReference) => Promise<SystemAsset | undefined> | SystemAsset | undefined;
  readonly resolveChildContract?: (component: SystemComponentReference) => Promise<AssetDraft["metadata"]["contract"] | undefined> | AssetDraft["metadata"]["contract"] | undefined;
  readonly maxDepth?: number;
}): Promise<void> {
  const issues = await evaluateSystemStudioDraftConsistency(input);
  if (issues.length === 0) {
    return;
  }

  throw new StudioShellInvalidRequestError(
    `Studio draft enforcement failed for '${input.expectation.studioType}': ${issues.map((issue) => `${issue.code}: ${issue.message}`).join(" ")}`,
  );
}
