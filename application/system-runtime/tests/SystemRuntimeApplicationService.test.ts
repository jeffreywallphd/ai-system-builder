import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { createSystemStudioTaxonomy } from "../../../domain/system-studio/SystemAssetDomain";
import { SystemRuntimeApplicationService } from "../SystemRuntimeApplicationService";
import { InMemorySystemRuntimeExecutionStore } from "../SystemRuntimeExecutionStore";

class RuntimeRepo implements IStudioShellRepository {
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { return studio; }
  async getStudio(_studioId: string): Promise<Studio | undefined> { return undefined; }
  async saveSession(session: AssetSession): Promise<AssetSession> { return session; }
  async getSession(_sessionId: string): Promise<AssetSession | undefined> { return undefined; }
  async listStudioSessions(_studioId: string): Promise<ReadonlyArray<AssetSession>> { return []; }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { return draft; }
  async getDraft(_draftId: string): Promise<AssetDraft | undefined> { return undefined; }
  async listSessionDrafts(_sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return []; }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId);
  }
}

function createVersion(input: {
  assetId: string;
  versionId: string;
  components?: ReadonlyArray<Record<string, unknown>>;
  nestedSystems?: ReadonlyArray<Record<string, unknown>>;
}) {
  return new AssetVersion({
    assetId: input.assetId,
    versionId: input.versionId,
    metadata: {
      metadata: {
        taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
      },
      content: JSON.stringify({
        systemSpec: {
          components: input.components ?? [],
          nestedSystems: input.nestedSystems ?? [],
          inputs: [{ inputId: "request", required: true, valueType: "object" }],
          outputs: [{ outputId: "result", valueType: "object" }],
        },
      }),
      dependencies: [],
    },
  });
}

describe("SystemRuntimeApplicationService", () => {
  it("persists execution metadata and links nested child system executions", async () => {
    const repository = new RuntimeRepo();
    const childVersion = createVersion({ assetId: "system:child", versionId: "system:child:v1" });
    const rootVersion = createVersion({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v1",
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
        },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });
    await repository.saveAssetVersion(childVersion);
    await repository.saveAssetVersion(rootVersion);

    const store = new InMemorySystemRuntimeExecutionStore();
    const service = new SystemRuntimeApplicationService(repository, store);

    const started = await service.startExecution({
      versionId: "system:root:v1",
      maxDepth: 4,
    });

    const parentRecord = store.getExecutionRecord(started.execution.executionId);
    expect(parentRecord).toBeDefined();
    expect(parentRecord?.metadata.executedVersionMap.rootVersionId).toBe("system:root:v1");
    expect(parentRecord?.metadata.childExecutionIds.length).toBe(1);

    const childExecutionId = parentRecord?.metadata.childExecutionIds[0]!;
    const childRecord = store.getExecutionRecord(childExecutionId);
    expect(childRecord?.metadata.parentExecutionId).toBe(started.execution.executionId);
    expect(childRecord?.metadata.parentNodeId).toContain("component:system:root:child:system:child:v1");

    const status = service.getExecutionStatus(started.execution.executionId);
    expect(status.nestedSystems.length).toBeGreaterThan(0);

    const result = service.getExecutionResult(started.execution.executionId);
    expect(result.nestedSystemResults.length).toBeGreaterThan(0);

    const recent = service.listRecentExecutionsForSystem({ assetId: "system:root", versionId: "system:root:v1" });
    expect(recent.length).toBe(1);
  });
});
