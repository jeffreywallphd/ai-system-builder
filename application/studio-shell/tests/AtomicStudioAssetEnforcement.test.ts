import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import { createModelAssetMetadata, createModelStudioTaxonomy } from "../../../domain/model-studio/ModelStudioDomain";
import { createDatasetAssetMetadata, createDatasetStudioTaxonomy } from "../../../domain/dataset-studio/DatasetStudioDomain";
import { createToolAssetMetadata, createToolStudioTaxonomy } from "../../../domain/tool-studio/ToolStudioDomain";
import {
  createPromptTemplateAssetMetadata,
  createPromptTemplateStudioTaxonomy,
} from "../../../domain/prompt-template-studio/PromptTemplateStudioDomain";
import {
  createEmbeddingIndexAssetMetadata,
  createEmbeddingIndexStudioTaxonomy,
} from "../../../domain/embedding-index-studio/EmbeddingIndexStudioDomain";
import {
  createConfigProfileAssetMetadata,
  createConfigProfileStudioTaxonomy,
} from "../../../domain/config-profile-studio/ConfigProfileStudioDomain";
import { createAssetDraft, createAssetSession } from "../../../domain/studio-shell/StudioShellDomain";
import {
  evaluateAtomicStudioDraftConsistency,
  evaluateCompositeStudioDraftConsistency,
  evaluateStudioDraftConsistency,
} from "../AtomicStudioAssetEnforcement";
import type { AssetMetadata } from "../../../domain/studio-shell/StudioShellDomain";

const resolver = new CompositionAssetContractResolver();

function createAtomicDraft(input: {
  readonly draftId: string;
  readonly studioId: string;
  readonly metadata: AssetMetadata;
}) {
  const session = createAssetSession({ id: `${input.draftId}-session`, studioId: input.studioId });
  return createAssetDraft({
    id: input.draftId,
    studioId: input.studioId,
    session,
    content: "{}",
    metadata: input.metadata,
  });
}

describe("evaluateAtomicStudioDraftConsistency", () => {
  it("accepts model/dataset/tool/prompt-template/embedding-index/config-profile atomic drafts when taxonomy + contract align with shared seams", () => {
    const modelTaxonomy = createModelStudioTaxonomy();
    const datasetTaxonomy = createDatasetStudioTaxonomy();
    const toolTaxonomy = createToolStudioTaxonomy("conditional");
    const promptTemplateTaxonomy = createPromptTemplateStudioTaxonomy();
    const embeddingIndexTaxonomy = createEmbeddingIndexStudioTaxonomy();
    const configProfileTaxonomy = createConfigProfileStudioTaxonomy();

    const modelDraft = createAtomicDraft({
      draftId: "draft-model",
      studioId: "studio-models",
      metadata: createModelAssetMetadata({
        title: "Model",
        contract: resolver.resolveContractForTaxonomy(modelTaxonomy),
      }),
    });
    const datasetDraft = createAtomicDraft({
      draftId: "draft-dataset",
      studioId: "studio-datasets",
      metadata: createDatasetAssetMetadata({
        title: "Dataset",
        contract: resolver.resolveContractForTaxonomy(datasetTaxonomy),
      }),
    });
    const toolDraft = createAtomicDraft({
      draftId: "draft-tool",
      studioId: "studio-tools",
      metadata: createToolAssetMetadata({
        title: "Tool",
        behaviorKind: "conditional",
        contract: resolver.resolveContractForTaxonomy(toolTaxonomy),
      }),
    });
    const promptTemplateDraft = createAtomicDraft({
      draftId: "draft-prompt-template",
      studioId: "studio-prompt-templates",
      metadata: createPromptTemplateAssetMetadata({
        title: "Prompt Template",
        contract: resolver.resolveContractForTaxonomy(promptTemplateTaxonomy),
      }),
    });
    const embeddingIndexDraft = createAtomicDraft({
      draftId: "draft-embedding-index",
      studioId: "studio-embedding-indexes",
      metadata: createEmbeddingIndexAssetMetadata({
        title: "Embedding Index",
        contract: resolver.resolveContractForTaxonomy(embeddingIndexTaxonomy),
      }),
    });
    const configProfileDraft = createAtomicDraft({
      draftId: "draft-config-profile",
      studioId: "studio-config-profiles",
      metadata: createConfigProfileAssetMetadata({
        title: "Config Profile",
        contract: resolver.resolveContractForTaxonomy(configProfileTaxonomy),
      }),
    });

    expect(evaluateAtomicStudioDraftConsistency({
      draft: modelDraft,
      expectation: { studioType: "model-studio", semanticRole: "model", allowedBehaviorKinds: ["none"] },
      contractResolver: resolver,
    })).toEqual([]);
    expect(evaluateAtomicStudioDraftConsistency({
      draft: datasetDraft,
      expectation: { studioType: "dataset-studio", semanticRole: "dataset", allowedBehaviorKinds: ["none"] },
      contractResolver: resolver,
    })).toEqual([]);
    expect(evaluateAtomicStudioDraftConsistency({
      draft: toolDraft,
      expectation: { studioType: "tool-studio", semanticRole: "tool", allowedBehaviorKinds: ["conditional", "deterministic"] },
      contractResolver: resolver,
    })).toEqual([]);
    expect(evaluateAtomicStudioDraftConsistency({
      draft: promptTemplateDraft,
      expectation: { studioType: "prompt-template-studio", semanticRole: "prompt-template", allowedBehaviorKinds: ["none"] },
      contractResolver: resolver,
    })).toEqual([]);
    expect(evaluateAtomicStudioDraftConsistency({
      draft: embeddingIndexDraft,
      expectation: { studioType: "embedding-index-studio", semanticRole: "embedding-index", allowedBehaviorKinds: ["none"] },
      contractResolver: resolver,
    })).toEqual([]);
    expect(evaluateAtomicStudioDraftConsistency({
      draft: configProfileDraft,
      expectation: { studioType: "config-profile-studio", semanticRole: "config-profile", allowedBehaviorKinds: ["none"] },
      contractResolver: resolver,
    })).toEqual([]);
  });

  it("reports taxonomy and contract drift for atomic drafts", () => {
    const draft = createAtomicDraft({
      draftId: "drift-draft",
      studioId: "studio-models",
      metadata: createModelAssetMetadata({
        title: "Model",
        contract: resolver.resolveContractForTaxonomy(createDatasetStudioTaxonomy()),
      }),
    });

    const issues = evaluateAtomicStudioDraftConsistency({
      draft,
      expectation: { studioType: "model-studio", semanticRole: "model", allowedBehaviorKinds: ["conditional"] },
      contractResolver: resolver,
    });

    expect(issues.map((issue) => issue.code)).toContain("taxonomy-behavior-kind-mismatch");
    expect(issues.map((issue) => issue.code)).toContain("contract-mismatch");
  });
});


describe("evaluateStudioDraftConsistency", () => {
  it("accepts composite workflow drafts when taxonomy/contract align with shared seams", () => {
    const workflowTaxonomy = {
      structuralKind: "composite" as const,
      semanticRole: "workflow" as const,
      behaviorKind: "deterministic" as const,
    };
    const draft = createAtomicDraft({
      draftId: "draft-workflow",
      studioId: "studio-workflows",
      metadata: {
        title: "Workflow",
        tags: ["workflow"],
        taxonomy: workflowTaxonomy,
        contract: resolver.resolveContractForTaxonomy(workflowTaxonomy),
        provenance: {
          sourceType: "generated",
          sourceLabel: "workflow-studio",
        },
      },
    });

    expect(evaluateStudioDraftConsistency({
      draft,
      expectation: {
        studioType: "workflow-studio",
        structuralKind: "composite",
        semanticRole: "workflow",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative"],
      },
      contractResolver: resolver,
    })).toEqual([]);
  });

  it("reports structural-kind mismatch for composite expectations", () => {
    const modelTaxonomy = createModelStudioTaxonomy();
    const draft = createAtomicDraft({
      draftId: "draft-not-composite",
      studioId: "studio-workflows",
      metadata: createModelAssetMetadata({
        title: "Model",
        contract: resolver.resolveContractForTaxonomy(modelTaxonomy),
      }),
    });

    const issues = evaluateStudioDraftConsistency({
      draft,
      expectation: {
        studioType: "workflow-studio",
        structuralKind: "composite",
        semanticRole: "workflow",
        allowedBehaviorKinds: ["deterministic"],
      },
      contractResolver: resolver,
    });

    expect(issues.map((issue) => issue.code)).toContain("taxonomy-structural-kind-mismatch");
  });
});

describe("evaluateCompositeStudioDraftConsistency", () => {
  it("enforces derivable taxonomy-contract consistency for planned composite roles", () => {
    const compositeRoles = [
      { role: "workflow" as const, behaviorKind: "deterministic" as const },
      { role: "context-bundle" as const, behaviorKind: "deterministic" as const },
      { role: "dataset-pipeline" as const, behaviorKind: "iterative" as const },
      { role: "training-recipe" as const, behaviorKind: "deterministic" as const },
      { role: "tool-chain" as const, behaviorKind: "deterministic" as const },
    ];

    for (const entry of compositeRoles) {
      const taxonomy = {
        structuralKind: "composite" as const,
        semanticRole: entry.role,
        behaviorKind: entry.behaviorKind,
      };
      const draft = createAtomicDraft({
        draftId: `draft-${entry.role}`,
        studioId: "studio-composite",
        metadata: {
          title: `Composite ${entry.role}`,
          tags: [entry.role],
          taxonomy,
          contract: resolver.resolveContractForTaxonomy(taxonomy),
          provenance: {
            sourceType: "generated",
            sourceLabel: "composite-studio",
          },
        },
      });
      const draftWithDependencies = {
        ...draft,
        dependencies: Object.freeze([{ assetId: "asset:dependency", versionId: "asset:dependency:v1" }]),
      };

      expect(evaluateCompositeStudioDraftConsistency({
        draft: draftWithDependencies,
        expectation: {
          studioType: `${entry.role}-studio`,
          semanticRole: entry.role,
          allowedBehaviorKinds: [entry.behaviorKind],
        },
        contractResolver: resolver,
      })).toEqual([]);
    }
  });

  it("flags non-derivable composite taxonomy-contract combinations at publish-time", () => {
    const taxonomy = {
      structuralKind: "composite" as const,
      semanticRole: "training-recipe" as const,
      behaviorKind: "deterministic" as const,
    };
    const draft = createAtomicDraft({
      draftId: "draft-training-recipe-drift",
      studioId: "studio-training-recipes",
      metadata: {
        title: "Training recipe drift",
        tags: ["training-recipe"],
        taxonomy,
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
        },
      },
    });
    const draftWithDependencies = {
      ...draft,
      dependencies: Object.freeze([{ assetId: "asset:training-dataset", versionId: "asset:training-dataset:v1" }]),
    };

    const issues = evaluateCompositeStudioDraftConsistency({
      draft: draftWithDependencies,
      expectation: {
        studioType: "training-recipe-studio",
        semanticRole: "training-recipe",
        allowedBehaviorKinds: ["deterministic"],
      },
      contractResolver: {
        resolveContractForTaxonomy: () => undefined,
      },
    });

    expect(issues.map((issue) => issue.code)).toContain("contract-not-derivable");
  });

  it("requires composite drafts to include pinned dependency references for publish enforcement", () => {
    const taxonomy = {
      structuralKind: "composite" as const,
      semanticRole: "workflow" as const,
      behaviorKind: "deterministic" as const,
    };
    const draft = createAtomicDraft({
      draftId: "draft-workflow-unpinned",
      studioId: "studio-workflows",
      metadata: {
        title: "Workflow",
        tags: ["workflow"],
        taxonomy,
        contract: resolver.resolveContractForTaxonomy(taxonomy),
        provenance: { sourceType: "generated", sourceLabel: "workflow-studio" },
      },
    });

    const issues = evaluateCompositeStudioDraftConsistency({
      draft: {
        ...draft,
        dependencies: Object.freeze([{ assetId: "asset:model" }]),
      },
      expectation: {
        studioType: "workflow-studio",
        semanticRole: "workflow",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative"],
      },
      contractResolver: resolver,
    });

    expect(issues.map((issue) => issue.code)).toContain("dependency-version-unpinned");
  });

  it("rejects disallowed composite behavior kinds across implemented composite studios", () => {
    const cases = [
      { role: "workflow" as const, behaviorKind: "iterative" as const, disallowedExpectation: ["deterministic", "conditional"] as const },
      { role: "context-bundle" as const, behaviorKind: "none" as const, disallowedExpectation: ["deterministic"] as const },
      { role: "dataset-pipeline" as const, behaviorKind: "iterative" as const, disallowedExpectation: ["deterministic"] as const },
      { role: "training-recipe" as const, behaviorKind: "deterministic" as const, disallowedExpectation: ["iterative"] as const },
      { role: "tool-chain" as const, behaviorKind: "deterministic" as const, disallowedExpectation: ["conditional"] as const },
    ];

    for (const entry of cases) {
      const draft = createAtomicDraft({
        draftId: `draft-${entry.role}-invalid-behavior`,
        studioId: "studio-composite",
        metadata: {
          title: `Composite ${entry.role}`,
          tags: [entry.role],
          taxonomy: {
            structuralKind: "composite",
            semanticRole: entry.role,
            behaviorKind: entry.behaviorKind,
          },
          contract: {
            version: "1.0.0",
            input: { kind: "json-schema" },
            output: { kind: "json-schema" },
          },
          provenance: {
            sourceType: "generated",
            sourceLabel: "composite-studio",
          },
        },
        dependencies: [{ assetId: "asset:dependency", versionId: "asset:dependency:v1" }],
      });

      const issues = evaluateCompositeStudioDraftConsistency({
        draft,
        expectation: {
          studioType: `${entry.role}-studio`,
          semanticRole: entry.role,
          allowedBehaviorKinds: [...entry.disallowedExpectation],
        },
        contractResolver: resolver,
      });

      expect(issues.map((issue) => issue.code)).toContain("taxonomy-behavior-kind-mismatch");
    }
  });
});
