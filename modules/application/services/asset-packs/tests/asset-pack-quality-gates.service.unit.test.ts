import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AssetDefinition, AssetMetadata, AssetPackAssetEntry } from "../../../../contracts/asset";
import { runAssetPackQualityGates } from "../asset-pack-quality-gates.service";

describe("asset pack quality gates", () => {
  it("passes a fixture entry with stable identity, display name, and AI context", () => {
    const result = runAssetPackQualityGates(validEntry());
    assert.equal(result.status, "valid");
    assert.deepEqual(result.issues, []);
  });

  it("fails when display name is missing", () => {
    const result = runAssetPackQualityGates(
      validEntry({ definition: validDefinition({ displayName: "" }) }),
    );
    assert.equal(result.status, "invalid");
    assert.match(messages(result), /display name/i);
  });

  it("returns an issue when AI context is missing", () => {
    const result = runAssetPackQualityGates(
      validEntry({ definition: validDefinition({ aiContext: undefined }) }),
    );
    assert.equal(result.status, "invalid");
    assert.match(messages(result), /AI context/i);
  });

  it("fails configurable fixtures without configuration schema", () => {
    const result = runAssetPackQualityGates(
      validEntry({ category: "forms-fields", definition: validDefinition({ configurationSchema: undefined }) }),
    );
    assert.equal(result.status, "invalid");
    assert.match(messages(result), /configuration schema/i);
  });

  it("fails renderer implementation paths and unsafe metadata values", () => {
    const result = runAssetPackQualityGates(
      validEntry({
        metadata: {
          sourcePack: { packId: "system.foundation", version: "1.0.0" },
          rendererImplementation: "apps/desktop/src/renderer/Foo.tsx",
        },
      }),
    );

    assert.equal(result.status, "invalid");
    assert.match(messages(result), /unsafe/i);
  });

  it("fails local paths, tokens, base64, and raw provider payloads", () => {
    const unsafeMetadataValues: readonly AssetMetadata[] = [
      { localPath: "C:\\Users\\alice\\secret.txt" },
      { note: "token=abc" },
      { image: "data:image/png;base64,AAAA" },
      { providerPayload: { raw: true } },
    ];
    for (const unsafe of unsafeMetadataValues) {
      const result = runAssetPackQualityGates(
        validEntry({
          metadata: {
            sourcePack: { packId: "system.foundation", version: "1.0.0" },
            ...unsafe,
          },
        }),
      );
      assert.equal(result.status, "invalid");
    }
  });

  it("warns on runtime execution requirements for UI primitive fixtures", () => {
    const result = runAssetPackQualityGates(
      validEntry({
        definition: validDefinition({
          requirements: [
            {
              requirementKind: "runtime-capability",
              required: true,
              runtimeCapabilityId: "image-generation",
              permissionKind: "runtime-execution",
            },
          ],
        }),
      }),
    );

    assert.equal(result.status, "valid-with-warnings");
    assert.match(messages(result), /runtime/i);
  });

  it("fails shell primitives that claim execution behavior", () => {
    const result = runAssetPackQualityGates(
      validEntry({
        category: "workflow-system-shells",
        definition: validDefinition({
          description: "Fixture shell that claims it can execute workflow runs.",
          aiContext: {
            ...validDefinition().aiContext,
            userFacingSummary: "Execute workflow runs from this shell.",
          },
        }),
      }),
    );

    assert.equal(result.status, "invalid");
    assert.match(messages(result), /execution behavior/i);
  });
});

function validEntry(overrides: Partial<AssetPackAssetEntry> = {}): AssetPackAssetEntry {
  const definition = overrides.definition ?? validDefinition();
  return {
    entryId: "system.foundation.fixture",
    definition,
    definitionRef: {
      kind: "asset-definition-version",
      id: String(definition.definitionId) as never,
      version: String(definition.version),
    },
    category: "ui-structure",
    sourceLayer: "system-default",
    fingerprint: "sha256.fixture",
    tags: ["foundation", "fixture"],
    metadata: {
      sourcePack: {
        packId: "system.foundation",
        version: "1.0.0",
      },
    },
    ...overrides,
  };
}

function validDefinition(overrides: Partial<AssetDefinition> = {}): AssetDefinition {
  return {
    definitionId: "system.foundation.fixture",
    assetType: "ui-component",
    assetFamily: "structural",
    version: "1.0.0",
    displayName: "Fixture Primitive",
    description: "Fixture-only structural primitive for quality gate tests.",
    lifecycleStatus: "published",
    reviewStatus: "approved",
    provenance: { sourceKind: "system-generated", authorship: "human-authored" },
    aiContext: {
      purpose: "Validate future foundation pack asset quality.",
      userFacingSummary: "Fixture primitive for quality gate tests.",
      developerFacingSummary: "Used by unit tests and not shipped as a real foundation asset.",
      capabilities: [{ capabilityId: "fixture.capability", summary: "Declares test semantics." }],
      limitations: [{ limitationId: "fixture.limitation", summary: "Does not execute or render." }],
      configurationGuidance: { summary: "Configure fixture labels with safe test values." },
      compositionGuidance: { summary: "Use only in tests." },
    },
    ports: [{ portId: "content", direction: "input", displayName: "Content" }],
    configurationSchema: {
      schemaId: "system.foundation.fixture.configuration",
      schemaVersion: "1.0.0",
      fields: [{ fieldId: "label", valueKind: "string", required: false, label: "Label" }],
    },
    ...overrides,
  };
}

function messages(result: { readonly issues: readonly { readonly message: string }[] }): string {
  return result.issues.map((issue) => issue.message).join("\n");
}
