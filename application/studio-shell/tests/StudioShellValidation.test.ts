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

  it("flags dependency identity/version mismatches using shared version-aware validation seams", async () => {
    const compositeTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const draft = createDraftWithTaxonomy(
      "draft-workflow-mismatch",
      compositeTaxonomy,
      [{ assetId: "asset:model", versionId: "asset:dataset:v1" }],
    );

    const issues = await buildStudioShellValidationIssues({
      draft,
      knownVersionIds: ["asset:dataset:v1"],
      versionExists: async () => true,
      resolveDependencyVersion: async () => Object.freeze({
        assetId: "asset:dataset",
      }),
    });

    expect(issues.some((issue) => issue.code === "dependency-asset-version-mismatch")).toBeTrue();
  });

  it("flags disallowed composite dependency semantic roles when dependency taxonomy is known", async () => {
    const compositeTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.toolChain,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const draft = createDraftWithTaxonomy(
      "draft-tool-chain-bad-dependency",
      compositeTaxonomy,
      [{ assetId: "asset:dataset", versionId: "asset:dataset:v1" }],
    );

    const issues = await buildStudioShellValidationIssues({
      draft,
      knownVersionIds: ["asset:dataset:v1"],
      versionExists: async () => true,
      resolveDependencyVersion: async () => Object.freeze({
        assetId: "asset:dataset",
        taxonomy: createDatasetStudioTaxonomy(),
      }),
    });

    expect(issues.some((issue) => issue.code === "composite-dependency-semantic-role-disallowed")).toBeTrue();
  });

  it("allows system drafts to depend on atomic/composite/system roles for system-of-systems composition", async () => {
    const systemTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });
    const systemDraft = createDraftWithTaxonomy(
      "draft-system-composition",
      systemTaxonomy,
      [
        { assetId: "asset:model", versionId: "asset:model:v1" },
        { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
        { assetId: "asset:system", versionId: "asset:system:v1" },
      ],
    );

    const byVersionId: Record<string, CompositionTaxonomyDescriptor> = {
      "asset:model:v1": createModelStudioTaxonomy(),
      "asset:workflow:v1": createCompositionTaxonomyDescriptor({
        structuralKind: TaxonomyStructuralKinds.composite,
        semanticRole: TaxonomySemanticRoles.workflow,
        behaviorKind: TaxonomyBehaviorKinds.deterministic,
      }),
      "asset:system:v1": createCompositionTaxonomyDescriptor({
        structuralKind: TaxonomyStructuralKinds.system,
        semanticRole: TaxonomySemanticRoles.system,
        behaviorKind: TaxonomyBehaviorKinds.deterministic,
      }),
    };

    const issues = await buildStudioShellValidationIssues({
      draft: systemDraft,
      knownVersionIds: Object.keys(byVersionId),
      versionExists: async () => true,
      resolveDependencyVersion: async (versionId) => Object.freeze({
        assetId: versionId.split(":v")[0]!,
        taxonomy: byVersionId[versionId],
      }),
    });

    expect(issues.some((issue) => issue.code === "composite-dependency-semantic-role-disallowed")).toBeFalse();
  });

  it("flags disallowed dependencies for system drafts when dependency semantic role is outside system scope", async () => {
    const systemTaxonomy = createCompositionTaxonomyDescriptor({
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const systemDraft = createDraftWithTaxonomy(
      "draft-system-disallowed",
      systemTaxonomy,
      [{ assetId: "asset:agent", versionId: "asset:agent:v1" }],
    );

    const issues = await buildStudioShellValidationIssues({
      draft: systemDraft,
      knownVersionIds: ["asset:agent:v1"],
      versionExists: async () => true,
      resolveDependencyVersion: async () => Object.freeze({
        assetId: "asset:agent",
        taxonomy: createCompositionTaxonomyDescriptor({
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.agent,
          behaviorKind: TaxonomyBehaviorKinds.autonomous,
        }),
      }),
    });

    expect(issues.some((issue) => issue.code === "composite-dependency-semantic-role-disallowed")).toBeTrue();
  });
});
