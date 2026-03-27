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
import { createAssetDraft, createAssetSession } from "../../../domain/studio-shell/StudioShellDomain";
import { evaluateAtomicStudioDraftConsistency } from "../AtomicStudioAssetEnforcement";
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
  it("accepts model/dataset/tool/prompt-template/embedding-index atomic drafts when taxonomy + contract align with shared seams", () => {
    const modelTaxonomy = createModelStudioTaxonomy();
    const datasetTaxonomy = createDatasetStudioTaxonomy();
    const toolTaxonomy = createToolStudioTaxonomy("conditional");
    const promptTemplateTaxonomy = createPromptTemplateStudioTaxonomy();
    const embeddingIndexTaxonomy = createEmbeddingIndexStudioTaxonomy();

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
