import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { Agent } from "@domain/agents/Agent";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import {
  createCompositionTaxonomyDescriptor,
  type CompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type TaxonomyBehaviorKind,
} from "@domain/taxonomy/CompositionTaxonomy";
import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { ContextPackage } from "../context/models/ContextPackage";
import type { ContextRecipe } from "../context/models/ContextRecipe";
import type { ToolCapabilityDescriptor } from "../tools/models/ToolCapabilityDescriptor";

export interface ICompositionTaxonomyClassifier {
  classifyCanonicalEntity(entityType: CanonicalEntityType): CompositionTaxonomyDescriptor;
  classifyAsset(asset: IAsset): CompositionTaxonomyDescriptor | undefined;
  classifyWorkflow(workflow: IWorkflow, behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative">): CompositionTaxonomyDescriptor;
  classifyAgent(agent: Agent): CompositionTaxonomyDescriptor;
  classifySystemAsset(semanticRole?: Extract<CompositionTaxonomyDescriptor["semanticRole"], "system" | "app-template">, behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative" | "autonomous">): CompositionTaxonomyDescriptor;
  classifyContextPackage(contextPackage: ContextPackage): CompositionTaxonomyDescriptor;
  classifyContextRecipe(contextRecipe: ContextRecipe): CompositionTaxonomyDescriptor;
  classifyToolCapability(capability: ToolCapabilityDescriptor): CompositionTaxonomyDescriptor;
}


type SpecializedCompositeSemanticRole = Extract<
  CompositionTaxonomyDescriptor["semanticRole"],
  "workflow" | "agent" | "context-bundle"
>;

const specializedCompositeDefaults: Readonly<Record<SpecializedCompositeSemanticRole, TaxonomyBehaviorKind>> = Object.freeze({
  [TaxonomySemanticRoles.workflow]: TaxonomyBehaviorKinds.deterministic,
  [TaxonomySemanticRoles.agent]: TaxonomyBehaviorKinds.autonomous,
  [TaxonomySemanticRoles.contextBundle]: TaxonomyBehaviorKinds.none,
});

function classifySpecializedCompositeRole(
  semanticRole: SpecializedCompositeSemanticRole,
  behaviorKind?: TaxonomyBehaviorKind,
): CompositionTaxonomyDescriptor {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole,
    behaviorKind: behaviorKind ?? specializedCompositeDefaults[semanticRole],
  });
}

const canonicalEntityClassificationMap: Readonly<Record<CanonicalEntityType, CompositionTaxonomyDescriptor>> = Object.freeze({
  "workflow-definition": createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.workflow,
    behaviorKind: TaxonomyBehaviorKinds.deterministic,
  }),
  "installed-model": createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.model,
    behaviorKind: TaxonomyBehaviorKinds.none,
  }),
  "base-model": createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.model,
    behaviorKind: TaxonomyBehaviorKinds.none,
  }),
  "dataset-version": createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.dataset,
    behaviorKind: TaxonomyBehaviorKinds.none,
  }),
  "execution-artifact": createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.system,
    semanticRole: TaxonomySemanticRoles.system,
    behaviorKind: TaxonomyBehaviorKinds.iterative,
  }),
});

function classifyAssetByPrefix(assetId: string): CompositionTaxonomyDescriptor | undefined {
  const prefixes: ReadonlyArray<readonly [string, CanonicalEntityType]> = [
    ["workflow-definition:", "workflow-definition"],
    ["installed-model:", "installed-model"],
    ["base-model:", "base-model"],
    ["dataset-version:", "dataset-version"],
    ["execution-artifact:", "execution-artifact"],
  ];

  const match = prefixes.find(([prefix]) => assetId.startsWith(prefix));
  return match ? canonicalEntityClassificationMap[match[1]] : undefined;
}

function classifyAssetByKind(asset: IAsset): CompositionTaxonomyDescriptor | undefined {
  if (asset.kind === "prompt") {
    return createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.promptTemplate,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
  }

  if (asset.kind === "workflow-template") {
    return createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflowTemplate,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
  }

  if (asset.kind === "embedding") {
    return createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.embeddingIndex,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
  }

  return undefined;
}

export class CompositionTaxonomyClassifier implements ICompositionTaxonomyClassifier {
  public classifyCanonicalEntity(entityType: CanonicalEntityType): CompositionTaxonomyDescriptor {
    return canonicalEntityClassificationMap[entityType];
  }

  public classifyAsset(asset: IAsset): CompositionTaxonomyDescriptor | undefined {
    return classifyAssetByPrefix(asset.id) ?? classifyAssetByKind(asset);
  }

  public classifyWorkflow(
    _workflow: IWorkflow,
    behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative"> = TaxonomyBehaviorKinds.deterministic,
  ): CompositionTaxonomyDescriptor {
    return classifySpecializedCompositeRole(TaxonomySemanticRoles.workflow, behaviorKind);
  }

  public classifyAgent(_agent: Agent): CompositionTaxonomyDescriptor {
    return classifySpecializedCompositeRole(TaxonomySemanticRoles.agent);
  }

  public classifySystemAsset(
    semanticRole: Extract<CompositionTaxonomyDescriptor["semanticRole"], "system" | "app-template"> = TaxonomySemanticRoles.system,
    behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative" | "autonomous"> = TaxonomyBehaviorKinds.deterministic,
  ): CompositionTaxonomyDescriptor {
    return createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole,
      behaviorKind,
    });
  }

  public classifyContextPackage(_contextPackage: ContextPackage): CompositionTaxonomyDescriptor {
    return classifySpecializedCompositeRole(TaxonomySemanticRoles.contextBundle);
  }

  public classifyContextRecipe(_contextRecipe: ContextRecipe): CompositionTaxonomyDescriptor {
    return classifySpecializedCompositeRole(TaxonomySemanticRoles.contextBundle, TaxonomyBehaviorKinds.deterministic);
  }

  public classifyToolCapability(capability: ToolCapabilityDescriptor): CompositionTaxonomyDescriptor {
    if (capability.provider.kind === "workflow") {
      return createCompositionTaxonomyDescriptor({
        structuralKind: TaxonomyStructuralKinds.composite,
        semanticRole: TaxonomySemanticRoles.toolChain,
        behaviorKind: TaxonomyBehaviorKinds.deterministic,
      });
    }

    return createCompositionTaxonomyDescriptor({
        structuralKind: TaxonomyStructuralKinds.atomic,
        semanticRole: TaxonomySemanticRoles.tool,
        behaviorKind: capability.provider.kind === "mcp"
        ? TaxonomyBehaviorKinds.conditional
        : TaxonomyBehaviorKinds.deterministic,
    });
  }
}

