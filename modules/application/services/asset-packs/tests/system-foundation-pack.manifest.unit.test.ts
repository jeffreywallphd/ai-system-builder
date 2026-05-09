import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateAssetPackManifest } from "../asset-pack-validation.service";
import {
  SYSTEM_FOUNDATION_PACK_CATEGORY_IDS,
  SYSTEM_FOUNDATION_PACK_MANIFEST,
  SYSTEM_FOUNDATION_PACK_SOURCE_LAYER,
  UI_STRUCTURAL_PRIMITIVE_ENTRIES,
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

  it("contains the expected categories and UI structural primitive assets", () => {
    assert.deepEqual(
      SYSTEM_FOUNDATION_PACK_MANIFEST.categories,
      SYSTEM_FOUNDATION_PACK_CATEGORY_IDS,
    );
    assert.deepEqual(
      SYSTEM_FOUNDATION_PACK_MANIFEST.assets.map((entry) => entry.entryId),
      UI_STRUCTURAL_PRIMITIVE_ENTRIES.map((entry) => entry.entryId),
    );
    assert.deepEqual(SYSTEM_FOUNDATION_PACK_MANIFEST.dependencies, []);
    assert.deepEqual(SYSTEM_FOUNDATION_PACK_MANIFEST.overrideRules, []);
  });

  it("keeps entry IDs, definition refs, and fingerprints unique and stable", () => {
    const entryIds = new Set<string>();
    const refKeys = new Set<string>();
    const fingerprints = new Set<string>();

    for (const entry of SYSTEM_FOUNDATION_PACK_MANIFEST.assets) {
      assert.equal(entry.category, "ui-structure");
      assert.equal(entry.sourceLayer, SYSTEM_FOUNDATION_PACK_SOURCE_LAYER);
      assert.match(entry.entryId, /^system\.foundation\.ui\.[a-z0-9.-]+$/);
      assert.match(entry.fingerprint, /^fnv1a:[a-f0-9]{8}$/);
      assert.equal(entryIds.has(entry.entryId), false, entry.entryId);
      assert.equal(refKeys.has(`${entry.definitionRef.id}@${entry.definitionRef.version}`), false);
      assert.equal(fingerprints.has(entry.fingerprint), false, entry.fingerprint);
      entryIds.add(entry.entryId);
      refKeys.add(`${entry.definitionRef.id}@${entry.definitionRef.version}`);
      fingerprints.add(entry.fingerprint);
    }
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
      "installstatus",
    ]) {
      assert.equal(output.includes(forbidden), false, forbidden);
    }
  });
});
