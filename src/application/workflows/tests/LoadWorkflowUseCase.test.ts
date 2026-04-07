import { describe, expect, it } from "bun:test";
import { LoadWorkflowUseCase } from "../LoadWorkflowUseCase";
import { makeWorkflow } from "@domain/services/tests/testUtils";
import { makeWorkflowRepository, makeWorkflowValidator } from "./testUtils";
import { CanonicalAssetIdentityService } from "../../assets-system/CanonicalAssetIdentityService";

describe("LoadWorkflowUseCase", () => {
  it("loads workflow and validates by default", async () => {
    const workflow = makeWorkflow({ id: "wf" });
    const useCase = new LoadWorkflowUseCase(
      makeWorkflowRepository({ load: async () => workflow }),
      makeWorkflowValidator()
    );

    const result = await useCase.execute({ workflowId: " wf " });
    expect(result.workflow?.id).toBe("wf");
    expect(result.validation?.isValid).toBeTrue();
  });

  it("handles missing workflow when throwIfNotFound is false", async () => {
    const result = await new LoadWorkflowUseCase(makeWorkflowRepository()).execute({
      workflowId: "missing",
      throwIfNotFound: false,
    });

    expect(result.workflow).toBeUndefined();
    expect(result.canonicalRead?.preferred).toBeFalse();
  });

  it("prefers canonical identity summary when configured", async () => {
    const workflow = makeWorkflow({ id: "wf-canonical" });
    const canonicalIdentityService = new CanonicalAssetIdentityService(
      {
        getIdentity: async () => ({
          entityType: "workflow-definition",
          entityId: "wf-canonical",
          assetId: "workflow-definition:wf-canonical",
          latestVersionId: "asset-version:wf",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
        upsertIdentity: async () => undefined,
      },
      {
        listVersionsByAssetId: async () => [],
      } as any,
    );

    const result = await new LoadWorkflowUseCase(
      makeWorkflowRepository({ load: async () => workflow }),
      makeWorkflowValidator(),
      {
        canonicalIdentityService,
        identityRepository: {
          getIdentity: async () => ({
            entityType: "workflow-definition",
            entityId: "wf-canonical",
            assetId: "workflow-definition:wf-canonical",
            latestVersionId: "asset-version:wf",
            updatedAt: new Date("2026-03-24T00:00:00.000Z"),
          }),
          upsertIdentity: async () => undefined,
        },
        assetRepository: {
          getById: async () => ({ id: "workflow-definition:wf-canonical", name: "WF", kind: "workflow-definition", status: "available" }),
        } as any,
        versionRepository: {
          getByVersionId: async () => ({ versionId: "asset-version:wf", assetId: { value: "workflow-definition:wf-canonical" } }),
          listVersionsByAssetId: async () => ([{ versionId: "asset-version:wf" }]),
          getLatestVersionForAsset: async () => ({ versionId: "asset-version:wf" }),
        } as any,
        lineageRepository: {
          listEdgesByVersionId: async () => [],
        } as any,
        transformationRepository: {
          listByVersionId: async () => [],
        } as any,
      },
    ).execute({ workflowId: "wf-canonical" });

    expect(result.canonicalRead?.preferred).toBeTrue();
    expect(result.canonicalRead?.assetId).toBe("workflow-definition:wf-canonical");
  });
});

