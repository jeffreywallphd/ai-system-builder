import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssetReference, AssetResourceBackedView } from "../../../../contracts/asset";
import { AssetSourceIdentityService } from "../asset-source-identity.service";

function view(overrides: Partial<AssetResourceBackedView> = {}): AssetResourceBackedView {
  return {
    viewId: "view.safe",
    viewKind: "artifact",
    assetType: "data-source",
    assetFamily: "resource-backed",
    sourceRef: { kind: "artifact", id: "artifact-ref.safe" as AssetReference["id"] },
    resourceBacking: {
      backingId: "artifact.safe",
      resourceKind: "artifact",
      ref: { kind: "artifact", id: "artifact-ref.safe" as AssetReference["id"] },
      role: "primary",
    },
    ...overrides,
  };
}

describe("asset source identity service", () => {
  it("derives deterministic safe source identity from resource-backed views", () => {
    const service = new AssetSourceIdentityService();
    const first = service.deriveFromResourceBackedView(view());
    const second = service.deriveFromResourceBackedView(view());
    assert.equal(first.ok, true);
    assert.equal(first.sourceIdentity?.deduplicationKey, second.sourceIdentity?.deduplicationKey);
    assert.equal(first.sourceIdentity?.sourceSystem, "artifact");
  });

  it("does not expose path-like or secret source values in source identity", () => {
    const result = new AssetSourceIdentityService().deriveFromResourceBackedView(view({
      viewId: "C:\\Users\\secret\\view",
      resourceBacking: {
        backingId: "C:\\Users\\secret\\artifact",
        resourceKind: "artifact",
        ref: { kind: "artifact", id: "artifact-ref.safe" as AssetReference["id"] },
      },
    }));
    assert.equal(result.ok, true);
    assert.doesNotMatch(JSON.stringify(result.sourceIdentity), /C:\\|Users|secret|token|base64|bytes|blob/i);
  });

  it("rejects views without reliable backing or source identity", () => {
    const result = new AssetSourceIdentityService().deriveFromResourceBackedView({
      viewId: "view.only",
      viewKind: "artifact",
    });
    assert.equal(result.ok, false);
    assert.equal(result.validationIssues?.[0]?.category, "identity");
  });
});
