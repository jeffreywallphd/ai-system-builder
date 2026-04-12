import { describe, expect, it } from "bun:test";
import {
  ConfigProfileStudioIdentity,
  createConfigProfileAssetMetadata,
  createConfigProfileStudioTaxonomy,
} from "../ConfigProfileStudioDomain";
import { normalizeAssetMetadata } from "../../studio-shell/StudioShellDomain";

describe("ConfigProfileStudioDomain", () => {
  it("builds canonical atomic config-profile taxonomy", () => {
    const taxonomy = createConfigProfileStudioTaxonomy();

    expect(taxonomy.structuralKind).toBe("atomic");
    expect(taxonomy.semanticRole).toBe("config-profile");
    expect(taxonomy.behaviorKind).toBe("none");
  });

  it("creates config-profile metadata with taxonomy and generated provenance", () => {
    const metadata = normalizeAssetMetadata(createConfigProfileAssetMetadata({
      title: "  Runtime Config Profile  ",
      tags: ["config-profile", "runtime", "runtime"],
      creatorId: " config-author-1 ",
    }));

    expect(metadata.title).toBe("Runtime Config Profile");
    expect(metadata.taxonomy?.semanticRole).toBe("config-profile");
    expect(metadata.provenance?.sourceType).toBe("generated");
    expect(metadata.provenance?.sourceLabel).toBe(ConfigProfileStudioIdentity.studioType);
    expect(metadata.tags).toEqual(["config-profile", "runtime"]);
  });
});
