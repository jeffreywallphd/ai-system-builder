import { describe, expect, it } from "../../../../testing/node-test";
import { createInMemoryStructuredDocumentStore } from "../../shared";
import { createStructuredSystemDeploymentRepository } from "../createStructuredSystemDeploymentRepository";

const deployment = (organizationId: string, workspaceId: string) =>
  ({
    deploymentId: "deployment-1",
    organizationId,
    workspaceId,
    releaseId: "release-1",
    releaseDigest: `sha256:${"a".repeat(64)}`,
    referenceRuntimeKind: "secured-data-entry",
    deploymentProfile: "local-desktop",
    status: "installed",
    revision: 0,
    compatibility: {
      compatible: true,
      deploymentProfile: "local-desktop",
      hostApiVersion: "1.0.0",
      runtimeKinds: ["trusted-built-in"],
      trustLevels: ["system-trusted"],
      sandboxRequired: false,
      sandboxQualified: false,
      checkedAt: "2026-07-17T00:00:00.000Z",
      diagnostics: [],
    },
    policy: {
      allowedCapabilities: [],
      allowedSecretReferences: [],
      egress: { mode: "deny-all", allowedOrigins: [] },
      quotas: {
        maximumRunSeconds: 60,
        maximumMemoryMiB: 256,
        maximumOutputBytes: 1024,
        maximumConcurrentRuns: 1,
      },
    },
    health: {
      status: "unknown",
      checkedAt: "2026-07-17T00:00:00.000Z",
      diagnostics: [],
    },
    installedAt: "2026-07-17T00:00:00.000Z",
    installedBy: "person-1",
    updatedAt: "2026-07-17T00:00:00.000Z",
  }) as any;

describe("structured system deployment repository", () => {
  it("isolates organization/workspace scopes and enforces optimistic updates", async () => {
    const repository = createStructuredSystemDeploymentRepository(
      createInMemoryStructuredDocumentStore(),
    );
    const value = deployment("org-a", "workspace-a");
    await repository.createDeployment(value);
    expect(
      await repository.readDeployment(
        "org-b" as any,
        "workspace-a" as any,
        "deployment-1" as any,
      ),
    ).toBeUndefined();
    expect(
      await repository.readDeployment(
        "org-a" as any,
        "workspace-b" as any,
        "deployment-1" as any,
      ),
    ).toBeUndefined();
    await expect(
      repository.updateDeployment(
        { ...value, status: "active", revision: 1 },
        0,
      ),
    ).resolves.toMatchObject({ status: "active", revision: 1 });
    await expect(
      repository.updateDeployment(
        { ...value, status: "failed", revision: 1 },
        0,
      ),
    ).rejects.toThrow();
  });
});
