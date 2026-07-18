import { describe, expect, it } from "../../../../testing/node-test";
import { createInMemoryStructuredDocumentStore } from "../../../../adapters/persistence/shared";
import { createWorkspaceId } from "../../../../contracts/workspace";
import { normalizeAssetId } from "../../../../contracts/asset";
import {
  SYSTEM_FOUNDATION_FUNCTIONAL_DEFAULTS,
  SYSTEM_FOUNDATION_PACK_MANIFEST,
} from "../../../../application/services/asset-packs";
import type { AssetDefinitionRepositoryPort } from "../../../../application/ports/asset";
import {
  composeAssetImplementationKernel,
  DEFAULT_TRUSTED_ASSET_IMPLEMENTATION_SEEDS,
} from "../composeAssetImplementationKernel";

const definitionRef = {
  kind: "asset-definition-version",
  id: normalizeAssetId("builtin.feature"),
  version: "1.0.0",
} as const;

const definitions: AssetDefinitionRepositoryPort = {
  async saveDefinition(definition) {
    return definition;
  },
  async getDefinition(reference) {
    if (
      reference.id !== definitionRef.id ||
      reference.version !== definitionRef.version
    )
      return undefined;
    return {
      definitionId: definitionRef.id,
      assetType: "feature",
      assetFamily: "structural",
      version: "1.0.0" as never,
      displayName: "Feature",
      description: "Reusable feature.",
      lifecycleStatus: "published",
      provenance: {
        sourceKind: "system-generated",
        createdAt: "2026-07-17T12:00:00.000Z",
      },
    };
  },
  async listDefinitions() {
    return { definitions: [] };
  },
};

describe("asset implementation host composition", () => {
  it("resolves one trusted built-in release in desktop and server deployment profiles", async () => {
    for (const profile of ["local-desktop", "campus-server"] as const) {
      const composition = composeAssetImplementationKernel({
        documents: createInMemoryStructuredDocumentStore(),
        definitions,
        trustedSeeds: [
          {
            definitionRef,
            releaseId: "implementation-release.builtin-feature.1" as never,
            bindingId: "implementation-binding.builtin-feature.1" as never,
            version: "1.0.0",
            entryKey: "foundation.feature",
            facetKind: "ui",
            runtimeKind: "trusted-built-in",
            deploymentProfiles: ["local-desktop", "campus-server"],
            packageDigest: `sha256:${"c".repeat(64)}`,
          },
        ],
        now: () => "2026-07-17T12:00:00.000Z",
      });
      await composition.ensureTrustedBuiltIns();
      await composition.ensureTrustedBuiltIns();
      const result = await composition.resolveTrustedBuiltIn(
        createWorkspaceId("workspace-a"),
        profile,
        definitionRef,
      );
      expect(result.status).toBe("ready");
      expect(result.selectedFacets[0]?.entryKey).toBe("foundation.feature");
    }
  });

  it("keeps unimplemented definitions visible as unavailable", async () => {
    const composition = composeAssetImplementationKernel({
      documents: createInMemoryStructuredDocumentStore(),
      definitions,
    });
    const result = await composition.resolveTrustedBuiltIn(
      createWorkspaceId("workspace-a"),
      "local-desktop",
      {
        kind: "asset-definition-version",
        id: normalizeAssetId("workspace.unimplemented"),
        version: "1.0.0",
      },
    );
    expect(result.status).toBe("unimplemented");
  });

  it("resolves every foundation default on every supported deployment profile", async () => {
    const byReference = new Map(
      SYSTEM_FOUNDATION_PACK_MANIFEST.assets.map((entry) => [
        `${entry.definition.definitionId}@${entry.definition.version}`,
        entry.definition,
      ]),
    );
    const foundationDefinitions: AssetDefinitionRepositoryPort = {
      saveDefinition: async (definition) => definition,
      getDefinition: async (reference) =>
        byReference.get(`${reference.id}@${reference.version}`),
      listDefinitions: async () => ({ definitions: [...byReference.values()] }),
    };
    const composition = composeAssetImplementationKernel({
      documents: createInMemoryStructuredDocumentStore(),
      definitions: foundationDefinitions,
      trustedSeeds: DEFAULT_TRUSTED_ASSET_IMPLEMENTATION_SEEDS,
      now: () => "2026-07-17T12:00:00.000Z",
    });
    await composition.ensureTrustedBuiltIns();

    for (const descriptor of SYSTEM_FOUNDATION_FUNCTIONAL_DEFAULTS) {
      for (const profile of descriptor.deploymentProfiles) {
        const result = await composition.resolveFoundationDefault(
          createWorkspaceId("workspace-a"),
          profile,
          {
            kind: "asset-definition-version",
            id: normalizeAssetId(descriptor.definitionId),
            version: descriptor.definitionVersion,
          },
          descriptor.facetKind,
        );
        expect(result.status).toBe("ready");
        expect(result.selectedFacets[0]?.entryKey).toBe(descriptor.entryKey);
      }
    }
  });
});
