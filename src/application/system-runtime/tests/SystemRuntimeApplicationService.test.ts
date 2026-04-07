import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "@domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { createSystemStudioTaxonomy } from "@domain/system-studio/SystemAssetDomain";
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
  executionMetadata?: Record<string, unknown>;
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
          executionMetadata: input.executionMetadata,
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

  it("rejects pathological runtime bound requests with typed invalid-request errors", async () => {
    const repository = new RuntimeRepo();
    await repository.saveAssetVersion(createVersion({
      assetId: "system:root",
      versionId: "system:root:v1",
    }));
    const service = new SystemRuntimeApplicationService(repository, new InMemorySystemRuntimeExecutionStore());

    await expect(service.startExecution({
      versionId: "system:root:v1",
      maxIterationsPerNode: 1000,
    })).rejects.toThrow("invalid-request:maxIterationsPerNode must be between 1 and 25.");
  });

  it("propagates resolved runtime capability trace into execution and persisted run metadata", async () => {
    const repository = new RuntimeRepo();
    await repository.saveAssetVersion(createVersion({
      assetId: "system:root",
      versionId: "system:root:v1",
      executionMetadata: {
        runtimeCapabilityBindings: {
          schemaVersion: "1.0.0",
          bindings: [
            {
              persistenceVersion: "1.0.0",
              selectedModelBindingId: "binding:model:sdxl-default",
              bindingContract: {
                bindingId: "runtime-binding:image-default",
                systemAssetId: "system:root",
                modelBindingId: "binding:model:sdxl-default",
                workflowExecutionProfile: {
                  profileId: "workflow-profile:image-generation",
                  workflowAssetId: "workflow:root:image",
                  executionIntent: "image-generation",
                  requiredCapabilityTags: ["image", "diffusion"],
                },
                executionProvider: {
                  providerId: "comfyui-local",
                  providerKind: "image-runtime",
                  labels: [],
                },
                executionOptionCapability: {
                  sampler: { required: false, allowedValues: ["euler"], defaultValue: "euler" },
                  steps: { required: false, minimum: 1, maximum: 100, defaultValue: 28 },
                  guidanceScale: { required: false, minimum: 1, maximum: 20, defaultValue: 7.5 },
                  seed: { required: false, allowDeterministic: true, allowRandom: true, defaultValue: { mode: "random" } },
                  resolution: { required: false, minimumWidth: 64, maximumWidth: 2048, minimumHeight: 64, maximumHeight: 2048, widthStep: 8, heightStep: 8, defaultValue: { width: 1024, height: 1024 } },
                  batch: { required: false, minimum: 1, maximum: 8, defaultValue: 1 },
                  runtime: { required: false, allowedDevices: ["auto", "gpu"], allowedPrecisions: ["auto", "fp16"], defaultValue: { device: "auto", precision: "auto" } },
                },
                executionOptions: { sampler: "euler", steps: 28 },
                availability: { status: "available", missingCapabilities: [] },
              },
              selectedExecutionOptions: { sampler: "euler", steps: 28 },
              resolved: {
                resolvedAt: "2026-04-01T00:00:00.000Z",
                resolverVersion: "1.0.0",
                resolvedExecutionOptions: { sampler: "euler", steps: 28 },
              },
            },
          ],
        },
      },
    }));

    const store = new InMemorySystemRuntimeExecutionStore();
    const service = new SystemRuntimeApplicationService(repository, store);
    const started = await service.startExecution({ versionId: "system:root:v1" });

    const record = store.getExecutionRecord(started.execution.executionId);
    expect(record?.metadata.runtimeCapability).toEqual({
      bindingId: "runtime-binding:image-default",
      providerId: "comfyui-local",
      profileId: "workflow-profile:image-generation",
      selectedModelBindingId: "binding:model:sdxl-default",
      resolvedAt: "2026-04-01T00:00:00.000Z",
      resolverVersion: "1.0.0",
      stale: false,
    });

    const result = service.getExecutionResult(started.execution.executionId);
    expect(result.runtimeCapability?.providerId).toBe("comfyui-local");
    expect((result.output?.payload as { runtimeCapability?: { stale?: boolean } } | undefined)?.runtimeCapability?.stale).toBe(false);
  });

  it("rejects system versions that include workflow bindings without explicit version pins", async () => {
    const repository = new RuntimeRepo();
    await repository.saveAssetVersion(new AssetVersion({
      assetId: "system:root",
      versionId: "system:root:v1",
      metadata: {
        metadata: {
          taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
        },
        content: JSON.stringify({
          systemSpec: {
            components: [],
            nestedSystems: [],
            inputs: [{ inputId: "request", required: true, valueType: "object" }],
            outputs: [{ outputId: "result", valueType: "object" }],
            serialization: {
              contractKind: "ai-loom.system-serialization",
              schemaVersion: "1.0.0",
              compatibility: {
                minimumReaderVersion: "1.0.0",
                legacySystemSpecSupported: true,
              },
              definition: {
                components: [],
                nestedSystems: [],
                dependencies: [],
                inputs: [],
                outputs: [],
                parameters: [],
                bindings: [],
              },
              assetReferences: { datasets: [], workflows: [] },
              runtime: {
                datasetInstances: [],
                workflowBindings: [{
                  bindingId: "component:primary",
                  workflowAssetId: "workflow:image-edit",
                  pinMode: "version",
                }],
              },
              ui: {},
            },
          },
        }),
        dependencies: [],
      },
    }));

    const service = new SystemRuntimeApplicationService(repository, new InMemorySystemRuntimeExecutionStore());
    await expect(service.startExecution({
      versionId: "system:root:v1",
    })).rejects.toThrow("serialized-reference-unresolved-workflow-version");
  });
});

