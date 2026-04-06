import { describe, expect, it } from "bun:test";
import {
  SecretClassificationIds,
  serializeSecretClassificationRegistry,
} from "../../../contracts/security/SecretClassificationContracts";
import {
  SecretClassificationSchemaValidationError,
  createSecretClassificationRegistrySnapshotPayload,
  parseSecretClassificationDefinition,
  parseSecretClassificationRegistrySnapshot,
} from "../SecretClassificationSchemaContracts";

describe("SecretClassificationSchemaContracts", () => {
  it("parses the seeded registry snapshot payload", () => {
    const payload = createSecretClassificationRegistrySnapshotPayload();
    expect(payload.version).toBe(1);
    expect(payload.classifications).toHaveLength(5);
    expect(payload.classifications[0]?.classificationId).toBe(SecretClassificationIds.providerCredential);
  });

  it("validates individual classification definitions", () => {
    const parsed = parseSecretClassificationDefinition({
      classificationId: SecretClassificationIds.integrationToken,
      description: "Integration token classification",
      namePrefix: "integration.",
      allowedKinds: ["access-token"],
      allowedScopes: ["workspace", "user"],
      entryMode: "system-generated",
      metadataLabelRules: [{
        field: "integration",
        required: true,
        description: "Integration id",
      }],
    });

    expect(parsed.classificationId).toBe(SecretClassificationIds.integrationToken);
    expect(parsed.namePrefix).toBe("integration.");
  });

  it("rejects malformed snapshots with duplicate classification ids", () => {
    expect(() => parseSecretClassificationRegistrySnapshot({
      version: 1,
      classifications: [{
        classificationId: SecretClassificationIds.providerCredential,
        description: "Provider",
        namePrefix: "provider.",
        allowedKinds: ["api-key"],
        allowedScopes: ["server"],
        entryMode: "user-entered",
        metadataLabelRules: [],
      }, {
        classificationId: SecretClassificationIds.providerCredential,
        description: "Duplicate Provider",
        namePrefix: "provider-duplicate.",
        allowedKinds: ["api-key"],
        allowedScopes: ["workspace"],
        entryMode: "user-entered",
        metadataLabelRules: [],
      }],
    })).toThrow(SecretClassificationSchemaValidationError);
  });

  it("round-trips serialized registry snapshots without shape drift", () => {
    const serialized = serializeSecretClassificationRegistry();
    const parsed = parseSecretClassificationRegistrySnapshot(JSON.parse(serialized));
    expect(JSON.stringify(parsed)).toBe(serialized);
  });
});
