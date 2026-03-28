import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { DesktopStudioShellBridge } from "../../../electron/shared/DesktopContracts";
import { StudioShellBackendApi } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { SqliteStudioShellRepository } from "../../../infrastructure/filesystem/studio-shell/SqliteStudioShellRepository";
import { AssetDraftLifecycleStatuses } from "../../../domain/studio-shell/StudioShellDomain";
import { StudioShellService } from "../StudioShellService";
import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";

const createdRoots: string[] = [];

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function installBridge(api: StudioShellBackendApi): void {
  const bridge: DesktopStudioShellBridge = {
    initializeStudio(studioId: string, name: string) {
      return api.initializeStudio(studioId, name).then((response) => JSON.stringify(response));
    },
    loadSnapshot(studioId: string) {
      return api.loadSnapshot(studioId).then((response) => JSON.stringify(response));
    },
    startSession(studioId: string) {
      return api.startSession(studioId).then((response) => JSON.stringify(response));
    },
    createDraft(requestJson: string) {
      return api.createDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateDraft(requestJson: string) {
      return api.updateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    updateDependencies(requestJson: string) {
      return api.updateDependencies(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    transitionLifecycle(requestJson: string) {
      return api.transitionLifecycle(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    publishVersion(requestJson: string) {
      return api.publishVersion(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    validateDraft(requestJson: string) {
      return api.validateDraft(JSON.parse(requestJson)).then((response) => JSON.stringify(response));
    },
    listSystemChildComponents() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    addSystemChildComponent() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    removeSystemChildComponent() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    reorderSystemChildComponent() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    updateSystemInterfaces() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    updateSystemParameters() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    updateSystemExecutionMetadata() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
    getSystemCompatibilityInsights() {
      return Promise.resolve(JSON.stringify({ ok: false, error: { code: "invalid-request", message: "not configured in this integration bridge" } }));
    },
  };

  (globalThis as { window?: Window }).window = {
    aiLoomDesktop: {
      studioShell: bridge,
    },
  } as Window;

}

interface StudioLifecycleScenario {
  readonly studioId: string;
  readonly studioName: string;
  readonly semanticRole: "workflow" | "context-bundle" | "dataset-pipeline" | "training-recipe" | "tool-chain";
  readonly behaviorKind: "none" | "deterministic" | "conditional" | "iterative";
  readonly content: string;
  readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId: string }>;
}

async function runLifecycleScenario(
  service: StudioShellService,
  contractResolver: CompositionAssetContractResolver,
  scenario: StudioLifecycleScenario,
  options: {
    readonly expectResolvableDependencies?: boolean;
  } = {},
): Promise<{
  readonly draftId: string;
  readonly versionId: string;
}> {
  const initialized = await service.initializeStudio(scenario.studioId, scenario.studioName);
  expect(initialized.ok).toBeTrue();
  const sessionId = initialized.data?.activeSessionId;
  expect(sessionId).toBeDefined();

  const created = await service.createDraft({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    content: scenario.content,
    metadata: {
      title: `${scenario.semanticRole}-asset`,
      tags: [scenario.semanticRole, "studio-shell", "composite"],
      taxonomy: {
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      },
      contract: contractResolver.resolveContractForTaxonomy({
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }),
      provenance: {
        sourceType: "generated",
        sourceLabel: `${scenario.semanticRole}-studio`,
      },
    },
    dependencies: scenario.dependencies,
  });
  expect(created.ok).toBeTrue();
  expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();
  expect(created.data?.validationIssues.some((entry) => entry.code === "version-history-empty")).toBeTrue();
  expect(created.data?.validationIssues.some((entry) => entry.code === "composite-dependency-recommended")).toBeFalse();

  const draftId = created.data?.draft?.draftId;
  expect(draftId).toBeDefined();

  const updated = await service.updateDraft({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    draftId: draftId!,
    content: `${scenario.content}\n`,
    metadataPatch: {
      summary: `${scenario.studioName} cross-studio consistency`,
    },
  });
  expect(updated.ok).toBeTrue();
  expect(updated.data?.draft?.revision).toBe(2);

  const validated = await service.transitionLifecycle({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    draftId: draftId!,
    targetStatus: AssetDraftLifecycleStatuses.validated,
  });
  expect(validated.ok).toBeTrue();
  expect(validated.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.validated);

  const versionId = `asset:${scenario.studioId}:v1`;
  const published = await service.publishVersion({
    studioId: scenario.studioId,
    sessionId: sessionId!,
    draftId: draftId!,
    versionId,
    versionLabel: "v1",
    createdBy: "composite-author",
  });
  expect(published.ok).toBeTrue();
  expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
  expect(published.data?.versions.map((entry) => entry.versionId)).toEqual([versionId]);
  expect(published.data?.draft?.metadata.taxonomy).toEqual({
    structuralKind: "composite",
    semanticRole: scenario.semanticRole,
    behaviorKind: scenario.behaviorKind,
  });
  expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
    structuralKind: "composite",
    semanticRole: scenario.semanticRole,
    behaviorKind: scenario.behaviorKind,
  }));

  const issues = await service.validateDraft(scenario.studioId, draftId!);
  expect(issues.ok).toBeTrue();
  if (options.expectResolvableDependencies !== false) {
    expect(issues.data?.some((entry) => entry.code === "dependency-version-not-found")).toBeFalse();
    expect(issues.data?.some((entry) => entry.code === "composite-dependency-semantic-role-disallowed")).toBeFalse();
  }
  expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();

  return Object.freeze({
    draftId: draftId!,
    versionId,
  });
}

describe("StudioShellService integration", () => {
  it("keeps model/dataset/tool/prompt-template/embedding-index/config-profile lifecycle and persisted contract-taxonomy behavior consistent across shared seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-atomic-studio-consistency-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "atomic-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const scenarios = [
      {
        studioId: "studio-models",
        name: "Model Studio",
        semanticRole: "model" as const,
        behaviorKind: "none" as const,
        content: "{\"modelSpec\":{\"provider\":\"local\",\"modelId\":\"mistral-7b\"}}",
        dependencies: [{ assetId: "asset:model-catalog", versionId: "asset:model-catalog:v1" }],
      },
      {
        studioId: "studio-datasets",
        name: "Dataset Studio",
        semanticRole: "dataset" as const,
        behaviorKind: "none" as const,
        content: "{\"datasetSpec\":{\"format\":\"jsonl\",\"schema\":{\"instruction\":\"string\"}}}",
        dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v3" }],
      },
      {
        studioId: "studio-tools",
        name: "Tool Studio",
        semanticRole: "tool" as const,
        behaviorKind: "conditional" as const,
        content: "{\"toolSpec\":{\"providerKind\":\"mcp\",\"serverId\":\"search\",\"operationId\":\"query\"}}",
        dependencies: [{ assetId: "asset:mcp-catalog", versionId: "asset:mcp-catalog:v2" }],
      },
      {
        studioId: "studio-prompt-templates",
        name: "Prompt Template Studio",
        semanticRole: "prompt-template" as const,
        behaviorKind: "none" as const,
        content: "{\"promptTemplateSpec\":{\"format\":\"mustache\",\"template\":\"You are a helpful assistant for {{audience}}.\",\"variables\":[\"audience\"]}}",
        dependencies: [{ assetId: "asset:prompt-library", versionId: "asset:prompt-library:v1" }],
      },
      {
        studioId: "studio-embedding-indexes",
        name: "Embedding Index Studio",
        semanticRole: "embedding-index" as const,
        behaviorKind: "none" as const,
        content: "{\"embeddingIndexSpec\":{\"provider\":\"local\",\"indexAlgorithm\":\"hnsw\",\"distanceMetric\":\"cosine\"}}",
        dependencies: [{ assetId: "asset:embedding-corpus", versionId: "asset:embedding-corpus:v1" }],
      },
      {
        studioId: "studio-config-profiles",
        name: "Config Profile Studio",
        semanticRole: "config-profile" as const,
        behaviorKind: "none" as const,
        content: "{\"runtimeProfile\":{\"preferredRuntime\":\"python\",\"executionPolicy\":\"acyclic-only\",\"environment\":{\"mode\":\"local\"}}}",
        dependencies: [{ assetId: "asset:runtime-policy", versionId: "asset:runtime-policy:v2" }],
      },
    ];

    for (const scenario of scenarios) {
      const initialized = await service.initializeStudio(scenario.studioId, scenario.name);
      expect(initialized.ok).toBeTrue();
      const sessionId = initialized.data?.activeSessionId;
      expect(sessionId).toBeDefined();

      const created = await service.createDraft({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        content: scenario.content,
        metadata: {
          title: `${scenario.semanticRole}-asset`,
          tags: [scenario.semanticRole, "studio-shell"],
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind: scenario.behaviorKind,
          },
          contract: contractResolver.resolveContractForTaxonomy({
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind: scenario.behaviorKind,
          }),
          provenance: {
            sourceType: "generated",
            sourceLabel: `${scenario.semanticRole}-studio`,
          },
        },
        dependencies: scenario.dependencies,
      });
      expect(created.ok).toBeTrue();
      expect(created.data?.validationIssues).toContainEqual(expect.objectContaining({
        code: "lifecycle-not-publish-ready",
      }));
      expect(created.data?.validationIssues).toContainEqual(expect.objectContaining({
        code: "version-history-empty",
      }));

      const draftId = created.data?.draft?.draftId;
      expect(draftId).toBeDefined();

      const updated = await service.updateDraft({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        content: `${scenario.content}\n`,
        metadataPatch: {
          summary: `${scenario.name} consistency draft`,
        },
      });
      expect(updated.ok).toBeTrue();
      expect(updated.data?.draft?.revision).toBe(2);

      const dependencyUpdated = await service.updateDependencies({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        dependencies: scenario.dependencies,
      });
      expect(dependencyUpdated.ok).toBeTrue();
      expect(dependencyUpdated.data?.draft?.dependencies).toEqual(scenario.dependencies);

      const validated = await service.transitionLifecycle({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        targetStatus: AssetDraftLifecycleStatuses.validated,
      });
      expect(validated.ok).toBeTrue();
      expect(validated.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.validated);

      const published = await service.publishVersion({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        versionId: `asset:${scenario.studioId}:v1`,
        versionLabel: "v1",
        createdBy: "atomic-author",
      });
      expect(published.ok).toBeTrue();
      expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
      expect(published.data?.versions.map((entry) => entry.versionId)).toEqual([`asset:${scenario.studioId}:v1`]);
      expect(published.data?.draft?.metadata.taxonomy).toEqual({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      });
      expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }));

      const issues = await service.validateDraft(scenario.studioId, draftId!);
      expect(issues.ok).toBeTrue();
      expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
      expect(issues.data?.some((entry) => entry.code === "version-history-empty")).toBeFalse();
    }

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    for (const scenario of scenarios) {
      const snapshot = await service.loadSnapshot(scenario.studioId);
      expect(snapshot.ok).toBeTrue();
      expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
      expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      });
      expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
        structuralKind: "atomic",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }));
      expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual([`asset:${scenario.studioId}:v1`]);
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "version-history-empty")).toBeFalse();
    }

    reopenedRepository.dispose();
  });

  it("supports Tool Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-tool-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "tool-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-tools", "Tool Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-tools",
      sessionId: sessionId!,
      content: '{"toolSpec":{"providerKind":"mcp","serverId":"search","operationId":"web.search"}}',
      metadata: {
        title: "Tool Asset Draft",
        tags: ["tool", "studio-shell", "mcp"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "tool",
          behaviorKind: "conditional",
        },
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
          parameters: [{ id: "providerKind", required: true, defaultValue: "mcp-or-api" }],
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "tool-studio",
        },
      },
      dependencies: [],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-tools",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-tools",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-tools:v1",
      versionLabel: "v1",
      createdBy: "tool-author",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("tool");
    expect(published.data?.draft?.metadata.taxonomy?.behaviorKind).toBe("conditional");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-tools:v1"]);

    repository.dispose();
  });

  it("supports Workflow Studio composite orchestrator flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-workflow-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workflow-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-workflows", "Workflow Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-workflows",
      sessionId: sessionId!,
      content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"Composite Workflow\"},\"executionPolicy\":\"acyclic-only\",\"nodes\":[],\"connections\":[]}}",
      metadata: {
        title: "Workflow Asset Draft",
        tags: ["workflow", "studio-shell", "composite"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "conditional",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "conditional",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "workflow-studio",
        },
      },
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v2" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();
    expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-workflows",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-workflows",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-workflows:v1",
      versionLabel: "v1",
      createdBy: "workflow-author",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    }));
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-workflows:v1"]);

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const snapshot = await service.loadSnapshot("studio-workflows");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    }));
    expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-workflows:v1"]);

    reopenedRepository.dispose();
  });

  it("supports Context Bundle Studio composite input-preparer flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-context-bundle-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "context-bundle-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-context-bundles", "Context Bundle Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-context-bundles",
      sessionId: sessionId!,
      content: "{\"contextBundleSpec\":{\"packageRefs\":[\"context-package:customer-profile\"],\"recipeRefs\":[\"context-recipe:retrieval-bounded\"],\"assemblyPolicy\":\"merge\"}}",
      metadata: {
        title: "Context Bundle Asset Draft",
        tags: ["context-bundle", "studio-shell", "composite", "input-preparer"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "context-bundle",
          behaviorKind: "deterministic",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "composite",
          semanticRole: "context-bundle",
          behaviorKind: "deterministic",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "context-bundle-studio",
        },
      },
      dependencies: [{ assetId: "asset:context-package", versionId: "asset:context-package:v2" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();
    expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-context-bundles",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-context-bundles",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-context-bundles:v1",
      versionLabel: "v1",
      createdBy: "context-author",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    });
    expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    }));
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-context-bundles:v1"]);

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const snapshot = await service.loadSnapshot("studio-context-bundles");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    });
    expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    }));
    expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-context-bundles:v1"]);

    reopenedRepository.dispose();
  });

  it("supports Training Recipe Studio composite flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-training-recipe-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "training-recipe-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-training-recipes", "Training Recipe Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-training-recipes",
      sessionId: sessionId!,
      content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v2\"],\"configProfileRef\":\"config-profile:runtime:v3\",\"executionKind\":\"local-gradient-training\",\"flow\":{\"epochs\":3,\"batchSize\":8}}}",
      metadata: {
        title: "Training Recipe Asset Draft",
        tags: ["training-recipe", "studio-shell", "composite", "model-training", "fine-tuning"],
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "training-recipe",
          behaviorKind: "deterministic",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "composite",
          semanticRole: "training-recipe",
          behaviorKind: "deterministic",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "training-recipe-studio",
        },
      },
      dependencies: [
        { assetId: "asset:base-model", versionId: "asset:base-model:v1" },
        { assetId: "asset:training-dataset", versionId: "asset:training-dataset:v2" },
        { assetId: "asset:runtime-config", versionId: "asset:runtime-config:v1" },
      ],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();
    expect(created.data?.validationIssues.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-training-recipes",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-training-recipes",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-training-recipes:v1",
      versionLabel: "v1",
      createdBy: "training-author",
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    });
    expect(published.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    }));
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-training-recipes:v1"]);

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const snapshot = await service.loadSnapshot("studio-training-recipes");
    expect(snapshot.ok).toBeTrue();
    expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    });
    expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: "training-recipe",
      behaviorKind: "deterministic",
    }));
    expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-training-recipes:v1"]);

    reopenedRepository.dispose();
  });

  it("keeps workflow/context-bundle/dataset-pipeline/training-recipe/tool-chain composite lifecycle and persisted taxonomy-contract behavior consistent across shared seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-composite-studio-consistency-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "composite-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();

    const scenarios: ReadonlyArray<StudioLifecycleScenario> = [
      {
        studioId: "studio-workflows",
        studioName: "Workflow Studio",
        semanticRole: "workflow",
        behaviorKind: "conditional",
        content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"Cross Studio Workflow\"},\"nodes\":[],\"connections\":[]}}",
        dependencies: [{ assetId: "asset:seed-model", versionId: "asset:seed-model:v1" }],
      },
      {
        studioId: "studio-context-bundles",
        studioName: "Context Bundle Studio",
        semanticRole: "context-bundle",
        behaviorKind: "deterministic",
        content: "{\"contextBundleSpec\":{\"packageRefs\":[\"context-package:customer\"],\"recipeRefs\":[\"context-recipe:bounded\"],\"assemblyPolicy\":\"merge\"}}",
        dependencies: [{ assetId: "asset:seed-context", versionId: "asset:seed-context:v1" }],
      },
      {
        studioId: "studio-dataset-pipelines",
        studioName: "Dataset Pipeline Studio",
        semanticRole: "dataset-pipeline",
        behaviorKind: "deterministic",
        content: "{\"datasetPipelineSpec\":{\"sources\":[{\"datasetRef\":\"dataset-version:raw:v1\"}],\"steps\":[{\"id\":\"clean\",\"kind\":\"data-cleaning\"}]}}",
        dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v1" }],
      },
      {
        studioId: "studio-training-recipes",
        studioName: "Training Recipe Studio",
        semanticRole: "training-recipe",
        behaviorKind: "deterministic",
        content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v1\"],\"configProfileRef\":\"config-profile:runtime:v1\"}}",
        dependencies: [{ assetId: "asset:seed-training", versionId: "asset:seed-training:v1" }],
      },
      {
        studioId: "studio-tool-chains",
        studioName: "Tool Chain Studio",
        semanticRole: "tool-chain",
        behaviorKind: "deterministic",
        content: "{\"toolChainSpec\":{\"tools\":[{\"toolAssetRef\":\"tool:lookup:v1\"}],\"invocationSteps\":[{\"id\":\"lookup\",\"kind\":\"tool-invocation\"}]}}",
        dependencies: [{ assetId: "asset:seed-tool", versionId: "asset:seed-tool:v1" }],
      },
    ];

    for (const scenario of scenarios) {
      await runLifecycleScenario(service, contractResolver, scenario, {
        expectResolvableDependencies: false,
      });
    }

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    for (const scenario of scenarios) {
      const snapshot = await service.loadSnapshot(scenario.studioId);
      expect(snapshot.ok).toBeTrue();
      expect(snapshot.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
      expect(snapshot.data?.draft?.metadata.taxonomy).toEqual({
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      });
      expect(snapshot.data?.draft?.metadata.contract).toEqual(contractResolver.resolveContractForTaxonomy({
        structuralKind: "composite",
        semanticRole: scenario.semanticRole,
        behaviorKind: scenario.behaviorKind,
      }));
      expect(snapshot.data?.draft?.dependencies).toEqual(scenario.dependencies);
      expect(snapshot.data?.versions.map((entry) => entry.versionId)).toEqual([`asset:${scenario.studioId}:v1`]);
    }

    reopenedRepository.dispose();
  });

  it("supports composite-to-atomic dependency reuse with pinned version interop over real shell/api/sqlite seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-composite-atomic-interop-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "composite-atomic-interop.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();

    const atomicScenarios = [
      { studioId: "studio-models", studioName: "Model Studio", semanticRole: "model" as const, content: "{\"modelSpec\":{\"provider\":\"local\"}}" },
      { studioId: "studio-datasets", studioName: "Dataset Studio", semanticRole: "dataset" as const, content: "{\"datasetSpec\":{\"format\":\"jsonl\"}}" },
      { studioId: "studio-tools", studioName: "Tool Studio", semanticRole: "tool" as const, content: "{\"toolSpec\":{\"providerKind\":\"mcp\"}}", behaviorKind: "conditional" as const },
      { studioId: "studio-prompt-templates", studioName: "Prompt Template Studio", semanticRole: "prompt-template" as const, content: "{\"promptTemplateSpec\":{\"format\":\"mustache\"}}" },
      { studioId: "studio-embedding-indexes", studioName: "Embedding Index Studio", semanticRole: "embedding-index" as const, content: "{\"embeddingIndexSpec\":{\"indexAlgorithm\":\"hnsw\"}}" },
      { studioId: "studio-config-profiles", studioName: "Config Profile Studio", semanticRole: "config-profile" as const, content: "{\"runtimeProfile\":{\"preferredRuntime\":\"python\"}}" },
    ];

    const publishedAtomicVersions = new Map<string, { assetId: string; versionId: string }>();

    for (const scenario of atomicScenarios) {
      const initialized = await service.initializeStudio(scenario.studioId, scenario.studioName);
      expect(initialized.ok).toBeTrue();
      const sessionId = initialized.data?.activeSessionId;
      expect(sessionId).toBeDefined();

      const behaviorKind = scenario.behaviorKind ?? "none";
      const created = await service.createDraft({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        content: scenario.content,
        metadata: {
          title: `${scenario.semanticRole}-atomic`,
          tags: [scenario.semanticRole, "studio-shell", "atomic"],
          taxonomy: {
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind,
          },
          contract: contractResolver.resolveContractForTaxonomy({
            structuralKind: "atomic",
            semanticRole: scenario.semanticRole,
            behaviorKind,
          }),
          provenance: {
            sourceType: "generated",
            sourceLabel: `${scenario.semanticRole}-studio`,
          },
        },
        dependencies: [{ assetId: `asset:${scenario.semanticRole}:seed`, versionId: `asset:${scenario.semanticRole}:seed:v1` }],
      });
      expect(created.ok).toBeTrue();
      const draftId = created.data?.draft?.draftId;
      expect(draftId).toBeDefined();
      const atomicAssetId = created.data?.draft?.assetId;
      expect(atomicAssetId).toBeDefined();

      const validated = await service.transitionLifecycle({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        targetStatus: AssetDraftLifecycleStatuses.validated,
      });
      expect(validated.ok).toBeTrue();

      const versionId = `asset:${scenario.studioId}:v1`;
      const published = await service.publishVersion({
        studioId: scenario.studioId,
        sessionId: sessionId!,
        draftId: draftId!,
        versionId,
        versionLabel: "v1",
        createdBy: "atomic-author",
      });
      expect(published.ok).toBeTrue();

      publishedAtomicVersions.set(scenario.semanticRole, {
        assetId: atomicAssetId!,
        versionId,
      });
    }

    const compositeScenarios: ReadonlyArray<StudioLifecycleScenario> = [
      {
        studioId: "studio-dataset-pipelines",
        studioName: "Dataset Pipeline Studio",
        semanticRole: "dataset-pipeline",
        behaviorKind: "deterministic",
        content: "{\"datasetPipelineSpec\":{\"sources\":[{\"datasetRef\":\"dataset-version:train:v1\"}],\"configProfileRef\":\"config-profile:runtime:v1\"}}",
        dependencies: [
          publishedAtomicVersions.get("dataset")!,
          publishedAtomicVersions.get("config-profile")!,
        ],
      },
      {
        studioId: "studio-training-recipes",
        studioName: "Training Recipe Studio",
        semanticRole: "training-recipe",
        behaviorKind: "deterministic",
        content: "{\"trainingRecipeSpec\":{\"baseModelRef\":\"installed-model:base:v1\",\"datasetRefs\":[\"dataset-version:train:v1\"],\"configProfileRef\":\"config-profile:runtime:v1\"}}",
        dependencies: [
          publishedAtomicVersions.get("model")!,
          publishedAtomicVersions.get("dataset")!,
          publishedAtomicVersions.get("config-profile")!,
        ],
      },
      {
        studioId: "studio-tool-chains",
        studioName: "Tool Chain Studio",
        semanticRole: "tool-chain",
        behaviorKind: "deterministic",
        content: "{\"toolChainSpec\":{\"tools\":[{\"toolAssetRef\":\"tool:lookup:v1\"}],\"invocationSteps\":[{\"id\":\"lookup\",\"kind\":\"tool-invocation\"}]}}",
        dependencies: [publishedAtomicVersions.get("tool")!],
      },
      {
        studioId: "studio-context-bundles",
        studioName: "Context Bundle Studio",
        semanticRole: "context-bundle",
        behaviorKind: "deterministic",
        content: "{\"contextBundleSpec\":{\"packageRefs\":[],\"recipeRefs\":[\"context-recipe:retrieval:v1\"],\"assemblyPolicy\":\"merge\"}}",
        dependencies: [
          publishedAtomicVersions.get("prompt-template")!,
          publishedAtomicVersions.get("embedding-index")!,
          publishedAtomicVersions.get("dataset")!,
        ],
      },
      {
        studioId: "studio-workflows",
        studioName: "Workflow Studio",
        semanticRole: "workflow",
        behaviorKind: "conditional",
        content: "{\"workflowSpec\":{\"metadata\":{\"name\":\"Interop Workflow\"},\"nodes\":[],\"connections\":[]}}",
        dependencies: [
          publishedAtomicVersions.get("model")!,
          publishedAtomicVersions.get("dataset")!,
          publishedAtomicVersions.get("tool")!,
          publishedAtomicVersions.get("prompt-template")!,
          publishedAtomicVersions.get("embedding-index")!,
          publishedAtomicVersions.get("config-profile")!,
        ],
      },
    ];

    for (const scenario of compositeScenarios) {
      const result = await runLifecycleScenario(service, contractResolver, scenario);
      const publishedVersion = await repository.getAssetVersion(result.versionId);
      expect(publishedVersion).toBeDefined();
      expect(publishedVersion?.upstreamVersionIds).toEqual(expect.arrayContaining(
        scenario.dependencies.map((entry) => entry.versionId),
      ));
    }

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    for (const scenario of compositeScenarios) {
      const snapshot = await service.loadSnapshot(scenario.studioId);
      expect(snapshot.ok).toBeTrue();
      expect(snapshot.data?.draft?.dependencies).toEqual(scenario.dependencies);
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "dependency-version-not-found")).toBeFalse();
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "dependency-asset-version-mismatch")).toBeFalse();
      expect(snapshot.data?.validationIssues.some((entry) => entry.code === "composite-dependency-semantic-role-disallowed")).toBeFalse();
    }

    reopenedRepository.dispose();
  });

  it("supports Dataset Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-dataset-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "dataset-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-datasets", "Dataset Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      content: '{"datasetSpec":{"format":"jsonl"}}',
      metadata: {
        title: "Dataset Asset Draft",
        tags: ["dataset", "studio-shell"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "dataset",
          behaviorKind: "none",
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "dataset-studio",
        },
      },
      dependencies: [{ assetId: "asset:seed-dataset", versionId: "asset:seed-dataset:v1" }],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-datasets",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-datasets:v1",
      versionLabel: "v1",
      createdBy: "dataset-curator",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("dataset");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-datasets:v1"]);

    repository.dispose();
  });

  it("supports Prompt Template Studio style flow over the same shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-prompt-template-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "prompt-template-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-prompt-templates", "Prompt Template Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-prompt-templates",
      sessionId: sessionId!,
      content: '{"promptTemplateSpec":{"format":"mustache","template":"Write a summary for {{topic}}.","variables":["topic"]}}',
      metadata: {
        title: "Prompt Template Asset Draft",
        tags: ["prompt-template", "studio-shell"],
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "prompt-template",
          behaviorKind: "none",
        },
        provenance: {
          sourceType: "generated",
          sourceLabel: "prompt-template-studio",
        },
      },
      dependencies: [{ assetId: "asset:prompt-library", versionId: "asset:prompt-library:v1" }],
    });
    expect(created.ok).toBeTrue();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-prompt-templates",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-prompt-templates",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-prompt-templates:v1",
      versionLabel: "v1",
      createdBy: "prompt-author",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("prompt-template");
    expect(published.data?.draft?.metadata.taxonomy?.behaviorKind).toBe("none");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-prompt-templates:v1"]);

    repository.dispose();
  });

  it("supports System Studio style flow over the same shared shell/persistence/publish seams", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-system-studio-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "system-studio.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const contractResolver = new CompositionAssetContractResolver();
    const initialized = await service.initializeStudio("studio-systems", "System Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;

    const created = await service.createDraft({
      studioId: "studio-systems",
      sessionId: sessionId!,
      content: "{\"systemSpec\":{\"components\":[],\"nestedSystems\":[]}}",
      metadata: {
        title: "System Asset Draft",
        tags: ["system", "studio-shell", "system-composition"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
        contract: contractResolver.resolveContractForTaxonomy({
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        }),
        provenance: {
          sourceType: "generated",
          sourceLabel: "system-studio",
        },
      },
      dependencies: [{ assetId: "asset:system-child", versionId: "asset:system-child:v1" }],
    });
    expect(created.ok).toBeTrue();
    expect(created.data?.validationIssues.some((entry) => entry.code === "composite-dependency-recommended")).toBeFalse();

    const draftId = created.data?.draft?.draftId;
    await service.transitionLifecycle({
      studioId: "studio-systems",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    const published = await service.publishVersion({
      studioId: "studio-systems",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-systems:v1",
      versionLabel: "v1",
      createdBy: "system-author",
    });

    expect(published.ok).toBeTrue();
    expect(published.data?.draft?.metadata.taxonomy?.structuralKind).toBe("system");
    expect(published.data?.draft?.metadata.taxonomy?.semanticRole).toBe("system");
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-systems:v1"]);

    repository.dispose();
  });

  it("executes the Studio Shell vertical flow through bridge -> backend -> application -> sqlite persistence", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-studio-shell-service-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "studio-shell.sqlite");
    const repository = new SqliteStudioShellRepository(databasePath);
    const backendApi = new StudioShellBackendApi(repository);
    installBridge(backendApi);

    const service = new StudioShellService();
    const initialized = await service.initializeStudio("studio-shell-main", "Studio Shell");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data?.activeSessionId;
    expect(sessionId).toBeDefined();

    const created = await service.createDraft({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      content: "{\"prompt\":\"first\"}",
      metadata: {
        title: "Studio Shell Draft",
        tags: ["studio-shell"],
      },
      dependencies: [{ assetId: "asset:seed" }],
    });
    expect(created.ok).toBeTrue();
    const draftId = created.data?.draft?.draftId;
    expect(draftId).toBeDefined();

    const updated = await service.updateDraft({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      content: "{\"prompt\":\"publishable\"}",
      metadataPatch: {
        title: "Studio Shell Draft v2",
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        contract: {
          version: "1.0.0",
          parameters: [{ id: "temperature", required: false }],
        },
        provenance: {
          creatorId: "author-1",
          sourceType: "generated",
        },
      },
    });
    expect(updated.ok).toBeTrue();

    const dependencies = await service.updateDependencies({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      dependencies: [{ assetId: "asset:seed", versionId: "asset:seed:v1" }],
    });
    expect(dependencies.ok).toBeTrue();

    const validated = await service.transitionLifecycle({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });
    expect(validated.ok).toBeTrue();

    const published = await service.publishVersion({
      studioId: "studio-shell-main",
      sessionId: sessionId!,
      draftId: draftId!,
      versionId: "asset:studio-shell-main:v1",
      versionLabel: "v1",
      createdBy: "author-1",
      upstreamVersionIds: ["asset:seed:v1"],
    });
    expect(published.ok).toBeTrue();
    expect(published.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-shell-main:v1"]);
    expect(published.data?.draft?.lifecycleStatus).toBe(AssetDraftLifecycleStatuses.published);
    expect(published.data?.draft?.lastPublishedVersionId).toBe("asset:studio-shell-main:v1");

    const issues = await service.validateDraft("studio-shell-main", draftId!);
    expect(issues.ok).toBeTrue();
    expect(issues.data?.some((entry) => entry.code === "lifecycle-not-publish-ready")).toBeFalse();
    expect(issues.data?.some((entry) => entry.code === "version-history-empty")).toBeFalse();

    repository.dispose();

    const reopenedRepository = new SqliteStudioShellRepository(databasePath);
    const reopenedApi = new StudioShellBackendApi(reopenedRepository);
    installBridge(reopenedApi);

    const reloadedSnapshot = await service.loadSnapshot("studio-shell-main");
    expect(reloadedSnapshot.ok).toBeTrue();
    expect(reloadedSnapshot.data?.draft?.draftId).toBe(draftId);
    expect(reloadedSnapshot.data?.draft?.content).toBe("{\"prompt\":\"publishable\"}");
    expect(reloadedSnapshot.data?.versions.map((entry) => entry.versionId)).toEqual(["asset:studio-shell-main:v1"]);

    reopenedRepository.dispose();
  });
});
