import { describe, expect, it } from "bun:test";
import {
  resolveCriticalServerSecurityMaterial,
} from "../composition/ResolveCriticalServerSecurityMaterial";
import type { SecurityMaterialStartupValidationResult } from "@application/security/services/SecurityMaterialStartupValidationPipeline";

describe("ResolveCriticalServerSecurityMaterial", () => {
  it("throws when critical material is missing and validation context is unavailable", () => {
    expect(() => resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      materialId: "material:server:asset-download-grant-secret",
      environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
      materialFormat: "string-secret",
    })).toThrow("Critical security material 'material:server:asset-download-grant-secret' is not configured.");
  });

  it("allows deterministic development fallback only when startup validation explicitly permits generated material", () => {
    const result = resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({
        NODE_ENV: "development",
      }),
      materialId: "material:server:image-upload-session-token-secret",
      environmentKey: "AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET",
      materialFormat: "string-secret",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:image-upload-session-token-secret",
        lifecycleStage: "development",
        productionCapable: false,
        sourceKind: "generated-ephemeral",
      }),
    });

    expect(result.startsWith("development-only:material:server:image-upload-session-token-secret:")).toBeTrue();
  });

  it("produces deterministic 32-byte base64 values for governed development AES key fallback", () => {
    const first = resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      materialId: "material:server:asset-content-encryption-key",
      environmentKey: "AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY",
      inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
      materialFormat: "aes256-base64",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:asset-content-encryption-key",
        lifecycleStage: "test",
        productionCapable: false,
        sourceKind: "generated-ephemeral",
      }),
    });
    const second = resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      materialId: "material:server:asset-content-encryption-key",
      environmentKey: "AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY",
      inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
      materialFormat: "aes256-base64",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:asset-content-encryption-key",
        lifecycleStage: "test",
        productionCapable: false,
        sourceKind: "generated-ephemeral",
      }),
    });

    expect(first).toBe(second);
    expect(Buffer.from(first, "base64").length).toBe(32);
  });
});

function createValidationResult(input: {
  readonly materialId: string;
  readonly lifecycleStage: "production" | "development" | "test";
  readonly productionCapable: boolean;
  readonly sourceKind: "environment" | "inherited-environment" | "generated-ephemeral" | "missing" | "not-applicable";
}): SecurityMaterialStartupValidationResult {
  return Object.freeze({
    state: "ready",
    lifecycleStage: input.lifecycleStage,
    productionCapable: input.productionCapable,
    observations: Object.freeze([Object.freeze({
      materialId: input.materialId,
      sourceKind: input.sourceKind,
      present: true,
      formatValid: true,
      persistence: "ephemeral",
    })]),
    issues: Object.freeze([]),
    fatalIssues: Object.freeze([]),
    warnings: Object.freeze([]),
  });
}
