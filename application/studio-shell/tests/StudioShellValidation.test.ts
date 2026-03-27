import { describe, expect, it } from "bun:test";
import { createAssetDraft, createAssetSession } from "../../../domain/studio-shell/StudioShellDomain";
import { createModelStudioTaxonomy } from "../../../domain/model-studio/ModelStudioDomain";
import { createDatasetStudioTaxonomy } from "../../../domain/dataset-studio/DatasetStudioDomain";
import { createToolStudioTaxonomy } from "../../../domain/tool-studio/ToolStudioDomain";
import { buildStudioShellValidationIssues } from "../StudioShellValidation";

function createDraftWithTaxonomy(draftId: string, taxonomy: ReturnType<typeof createModelStudioTaxonomy>) {
  const session = createAssetSession({ id: `session-${draftId}`, studioId: "studio-test" });
  return createAssetDraft({
    id: draftId,
    studioId: "studio-test",
    session,
    content: "{}",
    metadata: {
      title: `Draft ${draftId}`,
      tags: ["atomic"],
      taxonomy,
      contract: {
        version: "1.0.0",
        input: { kind: "json-schema" },
        output: { kind: "json-schema" },
      },
      provenance: {
        sourceType: "generated",
        sourceLabel: "atomic-studio",
      },
    },
    dependencies: [],
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
    }
  });
});
