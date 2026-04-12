import { describe, expect, it } from "bun:test";
import {
  SecurityMaterialRotationCutoverStrategies,
  SecurityMaterialRotationPolicyModes,
  SecurityMaterialRotationVersionStates,
  createSecurityMaterialRotationPolicyMetadata,
  createSecurityMaterialRotationVersionContract,
} from "@application/security/contracts/SecurityMaterialRotationContract";

describe("SecurityMaterialRotationContract", () => {
  it("creates version contracts with predecessor and successor linkage metadata", () => {
    const version = createSecurityMaterialRotationVersionContract({
      versionId: "secret:server:signing:v2",
      state: SecurityMaterialRotationVersionStates.active,
      effectiveFrom: "2026-04-10T00:00:00.000Z",
      predecessorVersionId: "secret:server:signing:v1",
      successorVersionId: "secret:server:signing:v3",
    });

    expect(version.versionId).toBe("secret:server:signing:v2");
    expect(version.state).toBe("active");
    expect(version.predecessorVersionId).toBe("secret:server:signing:v1");
    expect(version.successorVersionId).toBe("secret:server:signing:v3");
  });

  it("rejects invalid effective date windows for version metadata", () => {
    expect(() => createSecurityMaterialRotationVersionContract({
      versionId: "secret:server:provider:openai:v1",
      state: SecurityMaterialRotationVersionStates.previous,
      effectiveFrom: "2026-04-10T00:00:00.000Z",
      effectiveUntil: "2026-04-09T00:00:00.000Z",
    })).toThrow("effectiveUntil must be later than effectiveFrom");
  });

  it("creates policy metadata with scheduled rotation governance fields", () => {
    const policy = createSecurityMaterialRotationPolicyMetadata({
      rotationMode: SecurityMaterialRotationPolicyModes.scheduled,
      cutoverStrategy: SecurityMaterialRotationCutoverStrategies.scheduledCutover,
      rotationIntervalDays: 90,
      pendingActivationWindowDays: 7,
      maxActiveOverlapMinutes: 60,
      lastRotatedAt: "2026-04-01T00:00:00.000Z",
      nextRotationDueAt: "2026-07-01T00:00:00.000Z",
    });

    expect(policy.rotationMode).toBe("scheduled");
    expect(policy.rotationIntervalDays).toBe(90);
    expect(policy.pendingActivationWindowDays).toBe(7);
    expect(policy.maxActiveOverlapMinutes).toBe(60);
    expect(policy.nextRotationDueAt).toBe("2026-07-01T00:00:00.000Z");
  });
});
