import { describe, expect, it } from "bun:test";
import { ListInstalledModelsUseCase } from "../ListInstalledModelsUseCase";
import { makeModel } from "@domain/services/tests/testUtils";
import { makeInstalledModelCatalog } from "./testUtils";
import { CanonicalAssetIdentityService } from "../../assets-system/CanonicalAssetIdentityService";

describe("ListInstalledModelsUseCase", () => {
  it("lists installed models", async () => {
    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] })
    ).execute();

    expect(result.models.map((m) => m.id)).toEqual(["m"]);
  });

  it("returns canonical identity summaries when canonical resolution is configured", async () => {
    const canonicalIdentityService = new CanonicalAssetIdentityService(
      {
        getIdentity: async () => ({
          entityType: "installed-model",
          entityId: "m",
          assetId: "installed-model:m",
          latestVersionId: "asset-version:m:1",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
        upsertIdentity: async () => undefined,
      },
      {
        listVersionsByAssetId: async () => [],
      } as any,
    );

    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] }),
      canonicalIdentityService,
    ).execute();

    expect(result.canonicalByModelId?.m?.preferred).toBeTrue();
    expect(result.canonicalByModelId?.m?.assetId).toBe("installed-model:m");
  });

  it("prefers centralized canonical resolver details when provided", async () => {
    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] }),
      {
        resolveIdentity: async () => ({
          entityType: "installed-model",
          entityId: "m",
          assetId: "installed-model:m",
          latestVersionId: "asset-version:m:1",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
      } as any,
      {
        resolve: async () => ({
          preferred: true,
          assetId: "installed-model:m",
          pinnedVersionId: "asset-version:m:1",
          latestVersionId: "asset-version:m:2",
          provenance: { directUpstreamCount: 1, directDownstreamCount: 0, producingTransformationCount: 1, lineageConfidence: "exact" as const },
          dependencyState: {
            versionId: "asset-version:m:2",
            state: "healthy" as const,
            lineageConfidence: "exact" as const,
            reasons: ["ok"],
            impactedByUpstreamVersionIds: [],
            staleBecauseUpstreamAdvanced: [],
            nextActions: ["No reconciliation is required."],
          },
          operationalStatus: {
            trust: "trusted" as const,
            explanation: "Canonical dependency-state is healthy.",
            recommendedNextSteps: ["No reconciliation is required."],
          },
        }),
      } as any,
    ).execute();

    expect(result.canonicalByModelId?.m?.pinnedVersionId).toBe("asset-version:m:1");
    expect(result.canonicalByModelId?.m?.latestVersionId).toBe("asset-version:m:2");
    expect(result.canonicalByModelId?.m?.dependencyState?.state).toBe("healthy");
    expect(result.canonicalByModelId?.m?.operationalStatus?.trust).toBe("trusted");
  });


  it("projects canonical contracts into lightweight model-id map", async () => {
    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] }),
      {
        resolveIdentity: async () => ({
          entityType: "installed-model",
          entityId: "m",
          assetId: "installed-model:m",
          latestVersionId: "asset-version:m:1",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
      } as any,
      {
        resolve: async () => ({
          preferred: true,
          assetId: "installed-model:m",
          contract: {
            version: "1.0.0",
            input: { kind: "json-schema" },
            output: { kind: "json-schema" },
            parameters: [],
          },
        }),
      } as any,
    ).execute();

    expect(result.canonicalByModelId?.m?.contract?.version).toBe("1.0.0");
    expect(result.canonicalContractByModelId?.m?.version).toBe("1.0.0");
  });
  it("preserves explicit resolver fallback reason when canonical identity is missing", async () => {
    const result = await new ListInstalledModelsUseCase(
      makeInstalledModelCatalog({ listInstalled: async () => [makeModel("m")] }),
      {
        resolveIdentity: async () => undefined,
        resolveLatestVersionId: async () => undefined,
      } as any,
      {
        resolve: async () => ({
          preferred: false,
          fallbackReason: "No canonical identity mapping found for installed-model 'm'.",
        }),
      } as any,
    ).execute();
    expect(result.canonicalByModelId?.m?.fallbackReason).toContain("No canonical identity mapping");
  });
});

