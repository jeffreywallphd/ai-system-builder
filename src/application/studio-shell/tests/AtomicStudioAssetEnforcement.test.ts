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
  evaluateSystemStudioDraftConsistency,
  evaluateStudioDraftConsistency,
} from "../AtomicStudioAssetEnforcement";
import type { AssetMetadata } from "../../../domain/studio-shell/StudioShellDomain";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  SystemBindingEndpointScopes,
  SystemComponentKinds,
} from "../../../domain/system-studio/SystemAssetDomain";

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

describe("evaluateSystemStudioDraftConsistency", () => {
  it("allows missing draft contract metadata for system-studio runtime validation", async () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      taxonomy: createSystemStudioTaxonomy(),
    });
    const draft = createAtomicDraft({
      draftId: "draft-system-no-contract",
      studioId: "studio-systems",
      metadata: {
        title: "System Draft",
        tags: ["system"],
        taxonomy: root.taxonomy,
        provenance: { sourceType: "generated", sourceLabel: "system-studio" },
      },
    });

    const issues = await evaluateSystemStudioDraftConsistency({
      draft,
      expectation: {
        studioType: "system-studio",
        semanticRole: "system",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative", "autonomous"],
      },
      contractResolver: resolver,
      systemAsset: root,
      resolveSystem: async () => undefined,
      resolveChildContract: async () => undefined,
    });

    expect(issues.map((issue) => issue.code)).not.toContain("contract-missing");
  });

  it("does not require pinned versions for taxonomy-resolvable dataset and tool-chain child components", async () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:dataset:image-reference-input",
          alias: "input-dataset",
          taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
        },
        {
          componentKind: SystemComponentKinds.composite,
          assetId: "asset:tool-chain:reference-image-ui",
          alias: "reference-ui",
          taxonomy: { structuralKind: "composite", semanticRole: "tool-chain", behaviorKind: "deterministic" },
        },
      ],
      taxonomy: createSystemStudioTaxonomy(),
    });
    const draft = createAtomicDraft({
      draftId: "draft-system-unpinned-exemptions",
      studioId: "studio-systems",
      metadata: {
        title: "System Draft",
        tags: ["system"],
        taxonomy: root.taxonomy,
        contract: resolver.resolveContractForTaxonomy(root.taxonomy),
        provenance: { sourceType: "generated", sourceLabel: "system-studio" },
      },
    });

    const issues = await evaluateSystemStudioDraftConsistency({
      draft,
      expectation: {
        studioType: "system-studio",
        semanticRole: "system",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative", "autonomous"],
      },
      contractResolver: resolver,
      systemAsset: root,
      resolveSystem: async () => undefined,
      resolveChildContract: async (component) => component.taxonomy
        ? resolver.resolveContractForTaxonomy(component.taxonomy)
        : undefined,
    });

    expect(issues.map((issue) => issue.code)).not.toContain("system-child-version-unpinned");
  });

  it("accepts valid bounded recursive system drafts for publish enforcement", async () => {
    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [{
        componentKind: SystemComponentKinds.atomic,
        assetId: "asset:model",
        versionId: "asset:model:v1",
        alias: "child-model",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      }],
      inputs: [{ inputId: "childPrompt", valueType: "string", required: true }],
      outputs: [{ outputId: "childAnswer", valueType: "string" }],
    });
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [{
        componentKind: SystemComponentKinds.system,
        assetId: "system:child",
        versionId: "system:child:v1",
        alias: "child",
        taxonomy: createSystemStudioTaxonomy(),
      }],
      inputs: [{ inputId: "prompt", valueType: "string", required: true }],
      outputs: [{ outputId: "answer", valueType: "string" }],
      bindings: [{
        bindingId: "bind-parent-child",
        source: { scope: SystemBindingEndpointScopes.systemInput, endpointId: "prompt" },
        target: { scope: SystemBindingEndpointScopes.componentInput, componentAlias: "child", endpointId: "childPrompt" },
      }],
      taxonomy: createSystemStudioTaxonomy(),
    });

    const projected = await resolver.resolveSystemContract({
      root,
      resolveSystem: async (reference) => (reference.assetId === "system:child" ? child : undefined),
      resolveChildContract: async (component) => component.taxonomy
        ? resolver.resolveContractForTaxonomy(component.taxonomy)
        : undefined,
    });

    const draft = createAtomicDraft({
      draftId: "draft-system",
      studioId: "studio-systems",
      metadata: {
        title: "System Draft",
        tags: ["system"],
        taxonomy: root.taxonomy,
        contract: projected,
        provenance: { sourceType: "generated", sourceLabel: "system-studio" },
      },
    });

    const issues = await evaluateSystemStudioDraftConsistency({
      draft,
      expectation: {
        studioType: "system-studio",
        semanticRole: "system",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative", "autonomous"],
      },
      contractResolver: resolver,
      systemAsset: root,
      resolveSystem: async (reference) => (reference.assetId === "system:child" ? child : undefined),
      resolveChildContract: async (component) => {
        if (component.componentKind === SystemComponentKinds.system) {
          const nested = component.assetId === "system:child" ? child : undefined;
          return nested ? resolver.resolveSystemContract({
            root: nested,
            resolveSystem: async () => undefined,
          }) : undefined;
        }
        return component.taxonomy ? resolver.resolveContractForTaxonomy(component.taxonomy) : undefined;
      },
    });

    expect(issues).toEqual([]);
  });

  it("blocks invalid child references, incompatible bindings, and recursive cycles", async () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [{
        componentKind: SystemComponentKinds.system,
        assetId: "system:missing",
        versionId: "system:missing:v1",
        alias: "missing",
        taxonomy: createSystemStudioTaxonomy(),
      }],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
      inputs: [{ inputId: "prompt", valueType: "string", required: true }],
      outputs: [{ outputId: "answer", valueType: "string" }],
      bindings: [{
        bindingId: "bad-binding",
        source: { scope: SystemBindingEndpointScopes.systemInput, endpointId: "prompt" },
        target: { scope: SystemBindingEndpointScopes.componentInput, componentAlias: "missing", endpointId: "childPrompt" },
      }],
      taxonomy: createSystemStudioTaxonomy(),
    });
    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      nestedSystems: [{ assetId: "system:root", versionId: "system:root:v1", alias: "root" }],
      inputs: [{ inputId: "childPrompt", valueType: "number", required: true }],
      outputs: [{ outputId: "childAnswer", valueType: "string" }],
      taxonomy: createSystemStudioTaxonomy(),
    });

    const draft = createAtomicDraft({
      draftId: "draft-system-invalid",
      studioId: "studio-systems",
      metadata: {
        title: "System Draft Invalid",
        tags: ["system"],
        taxonomy: root.taxonomy,
        contract: resolver.resolveContractForTaxonomy(root.taxonomy),
        provenance: { sourceType: "generated", sourceLabel: "system-studio" },
      },
    });

    const issues = await evaluateSystemStudioDraftConsistency({
      draft,
      expectation: {
        studioType: "system-studio",
        semanticRole: "system",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative", "autonomous"],
      },
      contractResolver: resolver,
      systemAsset: root,
      resolveSystem: async (reference) => (
        reference.assetId === "system:child" ? child : reference.assetId === "system:root" ? root : undefined
      ),
      resolveChildContract: async () => undefined,
      maxDepth: 2,
    });

    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain("system-child-reference-missing");
    expect(codes).toContain("system-binding-endpoint-not-found");
    expect(codes).toContain("system-recursion-cycle-detected");
    expect(codes).toContain("contract-mismatch");
  });
});
