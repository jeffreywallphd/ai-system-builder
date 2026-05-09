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

  it("hashes safe-looking sensitive source IDs instead of exposing them", () => {
    const sensitiveSeeds = [
      "C:\\Users\\name\\image.png",
      "/tmp/generated.png",
      "https://host/file?token=abc",
      "hf://private/repo/model.safetensors?token=abc",
      "data:image/png;base64,AAAA",
      "prompt-a-beautiful-landscape",
      "workflowJson",
      "Bearer abc",
    ];

    for (const seed of sensitiveSeeds) {
      const result = new AssetSourceIdentityService().deriveFromResourceBackedView(view({
        viewId: seed,
        resourceBacking: {
          backingId: seed,
          resourceKind: "artifact",
          ref: { kind: "artifact", id: seed as AssetReference["id"] },
          role: "primary",
          metadata: {
            storageRootDirectory: "C:\\storage",
            runtimeRootDirectory: "/tmp/runtime",
            prompt: "prompt-a-beautiful-landscape",
            negativePrompt: "negative prompt text",
            workflowJson: { raw: true },
            token: "abc",
            authHeader: "Bearer abc",
            dataUrl: "data:image/png;base64,AAAA",
            rawProviderPayload: { value: seed },
            stack: "Error stack",
            commandLine: "python script.py",
            env: "TOKEN=abc",
          },
        },
        metadata: {
          localPath: "C:\\Users\\name\\image.png",
          cachePath: "/tmp/generated.png",
          prompt: "prompt-a-beautiful-landscape",
          workflowJson: { raw: true },
          token: "abc",
          rawProviderPayload: { value: seed },
        },
      }));

      assert.equal(result.ok, true, seed);
      const serialized = JSON.stringify(result.sourceIdentity);
      assert.match(result.sourceIdentity?.sourceId ?? "", /^(?:artifact|view)\.[a-z0-9]+$/i);
      assert.match(result.sourceIdentity?.deduplicationKey ?? "", /^asset-source\.artifact\.[a-z0-9]+$/i);
      assert.doesNotMatch(serialized, /C:\\|\/tmp|storage|runtime|hf:\/\/|https:\/\/host|token|Bearer|prompt-a-beautiful|negative prompt|workflowJson|data:image|base64|rawProvider|stack|python script|TOKEN=abc/i, seed);
    }
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
