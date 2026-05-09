import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateAssetPackManifest } from "../asset-pack-validation.service";
import {
  SYSTEM_FOUNDATION_PACK_CATEGORY_IDS,
  SYSTEM_FOUNDATION_PACK_MANIFEST,
} from "../system-packs";

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("system foundation pack manifest", () => {
  it("declares the system foundation placeholder pack identity and source metadata", () => {
    assert.equal(SYSTEM_FOUNDATION_PACK_MANIFEST.packId, "system.foundation");
    assert.equal(SYSTEM_FOUNDATION_PACK_MANIFEST.version, "1.0.0");
    assert.equal(SYSTEM_FOUNDATION_PACK_MANIFEST.sourceKind, "system");
    assert.equal(SYSTEM_FOUNDATION_PACK_MANIFEST.sourceLayer, "system-default");
    assert.equal(SYSTEM_FOUNDATION_PACK_MANIFEST.trustStatus, "system-trusted");
  });

  it("contains the expected categories and no assets yet", () => {
    assert.deepEqual(
      SYSTEM_FOUNDATION_PACK_MANIFEST.categories,
      SYSTEM_FOUNDATION_PACK_CATEGORY_IDS,
    );
    assert.deepEqual(SYSTEM_FOUNDATION_PACK_MANIFEST.assets, []);
    assert.deepEqual(SYSTEM_FOUNDATION_PACK_MANIFEST.dependencies, []);
    assert.deepEqual(SYSTEM_FOUNDATION_PACK_MANIFEST.overrideRules, []);
  });

  it("is JSON-serializable and validates through the pack validator", () => {
    const cloned = JSON.parse(JSON.stringify(SYSTEM_FOUNDATION_PACK_MANIFEST));
    assert.deepEqual(cloned, SYSTEM_FOUNDATION_PACK_MANIFEST);
    assert.equal(validateAssetPackManifest(SYSTEM_FOUNDATION_PACK_MANIFEST).status, "valid");
  });

  it("does not contain unsafe values or imply install and activation behavior", () => {
    const output = serialized(SYSTEM_FOUNDATION_PACK_MANIFEST);
    for (const forbidden of [
      "token",
      "secret",
      "password",
      "signedurl",
      "providerpayload",
      "resource bytes",
      "local path",
      "renderer implementation",
      "workflow json",
      "installstatus",
      "activate",
      "disable",
      "marketplace",
      "package manager",
    ]) {
      assert.equal(output.includes(forbidden), false, forbidden);
    }
  });
});
