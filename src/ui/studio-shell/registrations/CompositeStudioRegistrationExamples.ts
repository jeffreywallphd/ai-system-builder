import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import type { CompositeStudioRegistration } from "../StudioShellExtensions";
import { createCompositeStudioMetadataPatch } from "./AtomicStudioRegistrationDefaults";

function createCompositeRegistration(input: {
  readonly studioType: string;
  readonly studioId: string;
  readonly displayName: string;
  readonly role: CompositeStudioRegistration["role"];
  readonly defaultBehaviorKind: CompositeStudioRegistration["allowedBehaviorKinds"][number];
  readonly allowedBehaviorKinds: CompositeStudioRegistration["allowedBehaviorKinds"];
  readonly subtitle: string;
  readonly contentTemplate: unknown;
  readonly summary: string;
}): CompositeStudioRegistration {
  const taxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: input.role,
    behaviorKind: input.defaultBehaviorKind,
  });

  return Object.freeze({
    kind: "composite",
    studioType: input.studioType,
    studioId: input.studioId,
    displayName: input.displayName,
    role: input.role,
    allowedBehaviorKinds: Object.freeze([...input.allowedBehaviorKinds]),
    shell: Object.freeze({
      title: input.displayName,
      subtitle: input.subtitle,
    }),
    defaults: {
      title: `${input.displayName} Draft`,
      tags: Object.freeze([input.role, "studio-shell", "composite"]),
      contentTemplate: JSON.stringify(input.contentTemplate, null, 2),
      metadataPatch: createCompositeStudioMetadataPatch({
        title: `${input.displayName} Draft`,
        tags: [input.role, "studio-shell", "composite"],
        summary: input.summary,
        taxonomy,
        sourceLabel: input.studioType,
      }),
      dependencies: Object.freeze([]),
    },
    extensions: Object.freeze([
      {
        id: `${input.studioType}-draft-guidance`,
        slot: "draft-authoring",
        title: `${input.displayName} draft guidance`,
        subtitle: "Compose dependent assets with explicit version pinning for publish-ready drafts.",
        order: 10,
        render: ({ snapshot }) => Object.freeze([
          "Composite assets coordinate or transform other assets; keep structure in drafts and execution in behavior metadata.",
          `Composite role: ${input.role}`,
          `Draft asset id: ${snapshot?.draft?.assetId ?? "-"}`,
        ]),
      },
    ]),
  });
}

export const workflowStudioRegistrationExample = createCompositeRegistration({
  studioType: "workflow-studio",
  studioId: "studio-workflows",
  displayName: "Workflow Studio",
  role: TaxonomySemanticRoles.workflow,
  defaultBehaviorKind: TaxonomyBehaviorKinds.deterministic,
  allowedBehaviorKinds: Object.freeze([TaxonomyBehaviorKinds.deterministic, TaxonomyBehaviorKinds.conditional, TaxonomyBehaviorKinds.iterative]),
  subtitle: "Shared composite shell for orchestrator asset authoring.",
  contentTemplate: { workflowSpec: { steps: [], edges: [] } },
  summary: "Composite workflow (orchestrator) draft authored through shared Studio Shell registration.",
});

export const contextBundleStudioRegistrationExample = createCompositeRegistration({
  studioType: "context-bundle-studio",
  studioId: "studio-context-bundles",
  displayName: "Context Bundle Studio",
  role: TaxonomySemanticRoles.contextBundle,
  defaultBehaviorKind: TaxonomyBehaviorKinds.none,
  allowedBehaviorKinds: Object.freeze([TaxonomyBehaviorKinds.none, TaxonomyBehaviorKinds.deterministic]),
  subtitle: "Shared composite shell for input-preparer asset authoring.",
  contentTemplate: { contextBundleSpec: { sections: [] } },
  summary: "Composite context-bundle (input preparer) draft authored through shared Studio Shell registration.",
});

export const datasetPipelineStudioRegistrationExample = createCompositeRegistration({
  studioType: "dataset-pipeline-studio",
  studioId: "studio-dataset-pipelines",
  displayName: "Dataset Pipeline Studio",
  role: TaxonomySemanticRoles.datasetPipeline,
  defaultBehaviorKind: TaxonomyBehaviorKinds.deterministic,
  allowedBehaviorKinds: Object.freeze([TaxonomyBehaviorKinds.deterministic, TaxonomyBehaviorKinds.iterative]),
  subtitle: "Shared composite shell for dataset-pipeline asset authoring.",
  contentTemplate: { datasetPipelineSpec: { stages: [] } },
  summary: "Composite dataset-pipeline draft authored through shared Studio Shell registration.",
});

export const trainingRecipeStudioRegistrationExample = createCompositeRegistration({
  studioType: "training-recipe-studio",
  studioId: "studio-training-recipes",
  displayName: "Training Recipe Studio",
  role: TaxonomySemanticRoles.trainingRecipe,
  defaultBehaviorKind: TaxonomyBehaviorKinds.deterministic,
  allowedBehaviorKinds: Object.freeze([TaxonomyBehaviorKinds.deterministic]),
  subtitle: "Shared composite shell for training-recipe asset authoring.",
  contentTemplate: { trainingRecipeSpec: { recipeSteps: [] } },
  summary: "Composite training-recipe draft authored through shared Studio Shell registration.",
});

export const toolChainStudioRegistrationExample = createCompositeRegistration({
  studioType: "tool-chain-studio",
  studioId: "studio-tool-chains",
  displayName: "Tool Chain Studio",
  role: TaxonomySemanticRoles.toolChain,
  defaultBehaviorKind: TaxonomyBehaviorKinds.deterministic,
  allowedBehaviorKinds: Object.freeze([TaxonomyBehaviorKinds.deterministic]),
  subtitle: "Shared composite shell for tool-chain asset authoring.",
  contentTemplate: { toolChainSpec: { toolRefs: [] } },
  summary: "Composite tool-chain draft authored through shared Studio Shell registration.",
});
