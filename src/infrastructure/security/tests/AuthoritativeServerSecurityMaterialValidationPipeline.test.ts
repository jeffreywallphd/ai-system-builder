import { describe, expect, it } from "bun:test";
import { createHostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import { validateAuthoritativeServerStartupSecurityMaterial } from "../startup/AuthoritativeServerSecurityMaterialValidationPipeline";

describe("AuthoritativeServerSecurityMaterialValidationPipeline", () => {
  it("fails in production-capable startup when durable secret material falls back to generated values", () => {
    const result = validateAuthoritativeServerStartupSecurityMaterial({
      deploymentProfile: createHostDeploymentProfile({
        profileId: "organization",
        environmentName: "production",
        releaseChannel: "stable",
      }),
      environment: Object.freeze({
        NODE_ENV: "production",
      }),
    });

    expect(result.state).toBe("invalid");
    expect(result.fatalIssues.some((issue) => issue.materialId === "material:server:asset-download-grant-secret")).toBeTrue();
    expect(result.productionCapable).toBeTrue();
  });

  it("allows development startup while surfacing warnings for optional ephemeral allowances", () => {
    const result = validateAuthoritativeServerStartupSecurityMaterial({
      deploymentProfile: createHostDeploymentProfile({
        profileId: "home",
        environmentName: "development",
        releaseChannel: "development",
      }),
      environment: Object.freeze({
        NODE_ENV: "development",
      }),
    });

    expect(result.state).toBe("ready");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.fatalIssues).toHaveLength(0);
  });

  it("passes production startup when required security material is explicitly configured", () => {
    const result = validateAuthoritativeServerStartupSecurityMaterial({
      deploymentProfile: createHostDeploymentProfile({
        profileId: "organization",
        environmentName: "production",
        releaseChannel: "stable",
      }),
      environment: Object.freeze({
        NODE_ENV: "production",
        AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET: "asset-download-grant-secret-value-12345",
        AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY: "asset-content-encryption-key-value-12345",
        AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET: "image-storage-token-secret-value-12345",
        AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET: "image-upload-session-token-secret-value-12345",
        AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET: "generated-result-preview-token-secret-12345",
        AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS: "secret:server:provider:openai",
      }),
    });

    expect(result.state).toBe("ready");
    expect(result.fatalIssues).toHaveLength(0);
  });
});
