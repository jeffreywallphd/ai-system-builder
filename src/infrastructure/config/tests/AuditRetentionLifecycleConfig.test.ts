import { describe, expect, it } from "bun:test";
import {
  AuditRetentionLifecycleConfigError,
  AuditRetentionLifecycleEnvironmentKeys,
  AuditRetentionLifecycleExecutionModes,
  resolveAuditRetentionLifecycleConfig,
} from "../AuditRetentionLifecycleConfig";

describe("AuditRetentionLifecycleConfig", () => {
  it("resolves metadata-only retention configuration with defaults", () => {
    const resolved = resolveAuditRetentionLifecycleConfig({
      env: {},
    });

    expect(resolved.executionMode).toBe(AuditRetentionLifecycleExecutionModes.metadataOnly);
    expect(resolved.defaultRetentionAnchor).toBe("occurred-at");
    expect(resolved.destructiveActionsEnabled).toBeFalse();
  });

  it("resolves optional default policy metadata seams", () => {
    const resolved = resolveAuditRetentionLifecycleConfig({
      env: {
        [AuditRetentionLifecycleEnvironmentKeys.defaultPolicyKey]: "retention-policy:workspace-default",
        [AuditRetentionLifecycleEnvironmentKeys.defaultPolicyVersion]: "2026-04-07",
        [AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor]: "recorded-at",
      },
    });

    expect(resolved.defaultPolicyKey).toBe("retention-policy:workspace-default");
    expect(resolved.defaultPolicyVersion).toBe("2026-04-07");
    expect(resolved.defaultRetentionAnchor).toBe("recorded-at");
  });

  it("supports deployment-profile scoped retention defaults with global fallback", () => {
    const resolved = resolveAuditRetentionLifecycleConfig({
      deploymentProfile: {
        profileId: "classroom",
      },
      env: {
        [AuditRetentionLifecycleEnvironmentKeys.defaultPolicyKey]: "retention-policy:global-default",
        [AuditRetentionLifecycleEnvironmentKeys.defaultPolicyVersion]: "2026-04-07",
        [AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor]: "occurred-at",
        [`${AuditRetentionLifecycleEnvironmentKeys.defaultPolicyKey}_CLASSROOM`]: "retention-policy:classroom-default",
        [`${AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor}_CLASSROOM`]: "recorded-at",
      },
    });

    expect(resolved.defaultPolicyKey).toBe("retention-policy:classroom-default");
    expect(resolved.defaultPolicyVersion).toBe("2026-04-07");
    expect(resolved.defaultRetentionAnchor).toBe("recorded-at");
  });

  it("falls back to global defaults when deployment-profile scoped values are absent", () => {
    const resolved = resolveAuditRetentionLifecycleConfig({
      deploymentProfile: {
        profileId: "home",
      },
      env: {
        [AuditRetentionLifecycleEnvironmentKeys.defaultPolicyKey]: "retention-policy:global-default",
        [AuditRetentionLifecycleEnvironmentKeys.defaultPolicyVersion]: "2026-04-07",
        [AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor]: "recorded-at",
      },
    });

    expect(resolved.defaultPolicyKey).toBe("retention-policy:global-default");
    expect(resolved.defaultPolicyVersion).toBe("2026-04-07");
    expect(resolved.defaultRetentionAnchor).toBe("recorded-at");
  });

  it("rejects unsupported destructive lifecycle toggles", () => {
    expect(() => resolveAuditRetentionLifecycleConfig({
      env: {
        [AuditRetentionLifecycleEnvironmentKeys.allowDestructiveActions]: "true",
      },
    })).toThrow(AuditRetentionLifecycleConfigError);
  });
});
