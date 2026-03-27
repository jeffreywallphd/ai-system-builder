import { describe, expect, it } from "bun:test";
import { createAssetDraft, createAssetSession } from "../../../domain/studio-shell/StudioShellDomain";
import { createModelStudioTaxonomy } from "../../../domain/model-studio/ModelStudioDomain";
import { createDatasetStudioTaxonomy } from "../../../domain/dataset-studio/DatasetStudioDomain";
import { createToolStudioTaxonomy } from "../../../domain/tool-studio/ToolStudioDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type CompositionTaxonomyDescriptor,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import { buildStudioShellValidationIssues } from "../StudioShellValidation";

function createDraftWithTaxonomy(
  draftId: string,
  taxonomy: CompositionTaxonomyDescriptor,
  dependencies: Array<{ assetId: string; versionId?: string }> = [],
) {
  const session = createAssetSession({ id: `session-${draftId}`, studioId: "studio-test" });
  return createAssetDraft({
    id: draftId,
    studioId: "studio-test",
    session,
    content: "{}",
    metadata: {
      title: `Draft ${draftId}`,
      tags: ["asset"],
      taxonomy,
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
      provenance: {
        sourceType: "generated",
        sourceLabel: "studio",
      },
    },
    dependencies,
  });
}

describe("buildStudioShellValidationIssues", () => {
  it("emits consistent publish-readiness issues across model/dataset/tool atomic drafts", async () => {
    const drafts = [
      createDraftWithTaxonomy("draft-model", createModelStudioTaxonomy()),
      createDraftWithTaxonomy("draft-dataset", createDatasetStudioTaxonomy()),
      createDraftWithTaxonomy("draft-tool", createToolStudioTaxonomy("conditional")),
    ];

    for (const draft of drafts) {
      const issues = await buildStudioShellValidationIssues({
        draft,
        knownVersionIds: [],
        versionExists: async () => false,
      });

      expect(issues.some((issue) => issue.code === "lifecycle-not-publish-ready")).toBeTrue();
      expect(issues.some((issue) => issue.code === "version-history-empty")).toBeTrue();
      expect(issues.some((issue) => issue.code === "taxonomy-missing")).toBeFalse();
      expect(issues.some((issue) => issue.code === "contract-missing")).toBeFalse();
      expect(issues.some((issue) => issue.code === "provenance-missing")).toBeFalse();
      expect(issues.some((issue) => issue.code === "dependency-version-unpinned")).toBeFalse();
      expect(issues.some((issue) => issue.code === "composite-dependency-recommended")).toBeFalse();
    }
  });

  it("warns when composite drafts omit dependencies and clears the warning once dependencies are pinned", async () => {
    const compositeTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });

    const noDependencyDraft = createDraftWithTaxonomy("draft-workflow-empty", compositeTaxonomy);
    const withDependencyDraft = createDraftWithTaxonomy(
      "draft-workflow-linked",
      compositeTaxonomy,
      [{ assetId: "asset:model", versionId: "asset:model:v1" }],
    );

    const missingDependencyIssues = await buildStudioShellValidationIssues({
      draft: noDependencyDraft,
      knownVersionIds: ["asset:model:v1"],
      versionExists: async () => false,
    });
    expect(missingDependencyIssues.some((issue) => issue.code === "composite-dependency-recommended")).toBeTrue();

    const linkedIssues = await buildStudioShellValidationIssues({
      draft: withDependencyDraft,
      knownVersionIds: ["asset:model:v1"],
      versionExists: async () => false,
    });
    expect(linkedIssues.some((issue) => issue.code === "composite-dependency-recommended")).toBeFalse();
  });
});
