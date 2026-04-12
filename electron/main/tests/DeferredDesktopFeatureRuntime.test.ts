/**
 * Integration-style tests for deferred desktop runtime feature composition and lifecycle orchestration behavior.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { AppRuntimeConfigValues } from "../../../src/infrastructure/config/AppRuntimeConfig";
import type { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import { createDeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";
import type {
  SystemRuntimeObservabilityEvent,
  SystemRuntimeObservabilityLogger,
} from "../../../src/infrastructure/api/system-runtime/SystemRuntimeObservability";

type DesktopStoragePaths = ReturnType<typeof resolveDesktopStoragePaths>;

function createRuntimeConfigValues(): AppRuntimeConfigValues {
  return {
    workflowStorageDirectory: "dev/workflow-data/workflows",
    workflowIndexDatabasePath: "dev/workflow-data/workflows/workflow-index.sqlite",
  } as AppRuntimeConfigValues;
}

describe("createDeferredDesktopFeatureRuntime", () => {
  class CapturingSystemRuntimeObservabilityLogger implements SystemRuntimeObservabilityLogger {
    public readonly infoEvents: SystemRuntimeObservabilityEvent[] = [];
    public readonly warnEvents: SystemRuntimeObservabilityEvent[] = [];
    public readonly errorEvents: SystemRuntimeObservabilityEvent[] = [];

    public info(event: SystemRuntimeObservabilityEvent): void {
      this.infoEvents.push(event);
    }

    public warn(event: SystemRuntimeObservabilityEvent): void {
      this.warnEvents.push(event);
    }

    public error(event: SystemRuntimeObservabilityEvent): void {
      this.errorEvents.push(event);
    }
  }

  it("lazily creates workflow/studio/system runtime dependencies on first use", () => {
    const created: Record<string, number> = Object.create(null);
    const increment = (key: string) => {
      created[key] = (created[key] ?? 0) + 1;
    };

    const runtime = createDeferredDesktopFeatureRuntime({
      storagePaths: {
        databasePath: "db.sqlite",
        storageDirectory: "storage",
        assetsDirectory: "assets",
      } as DesktopStoragePaths,
      runtimeConfigValues: createRuntimeConfigValues(),
      repoRoot: "C:/repo",
      factories: {
        createWorkflowPersistence() {
          increment("workflowPersistence");
          return {} as never;
        },
        createExecutionRunRepository() {
          increment("executionRunRepository");
          return {} as never;
        },
        createExecutionHistoryInfrastructure() {
          increment("executionHistoryInfrastructure");
          return {
            executionRunProjectionService: {},
            executionRunDetailProjectionService: {},
            listExecutionRunsUseCase: {},
            listRelatedExecutionRunsUseCase: {},
            getExecutionRunDetailUseCase: {},
          } as never;
        },
        createGetExecutionRunUseCase() {
          increment("getExecutionRunUseCase");
          return {} as never;
        },
        createWorkflowRunSummaryRepository() {
          increment("workflowRunSummaryRepository");
          return {} as never;
        },
        createListWorkflowRunSummariesUseCase() {
          increment("listWorkflowRunSummariesUseCase");
          return {} as never;
        },
        createStudioShellRepository() {
          increment("studioShellRepository");
          return {} as never;
        },
        createWorkflowPersistenceRepository() {
          increment("workflowPersistenceRepository");
          return {} as never;
        },
        createImageRunHistoryRepository() {
          increment("imageRunHistoryRepository");
          return {} as never;
        },
        createImageWorkflowSystemPersistence() {
          increment("imageWorkflowSystemPersistence");
          return {} as never;
        },
        createStudioShellBackendApi() {
          increment("studioShellBackendApi");
          return {} as never;
        },
        createSystemStudioBackendApi() {
          increment("systemStudioBackendApi");
          return {} as never;
        },
        createSystemRuntimeExecutionStore() {
          increment("systemRuntimeExecutionStore");
          return {} as never;
        },
        createSystemRuntimeExecutionAuditRepository() {
          increment("systemRuntimeExecutionAuditRepository");
          return {} as never;
        },
        createSystemRuntimeBackendApi() {
          increment("systemRuntimeBackendApi");
          return {} as never;
        },
      },
    });

    expect(created).toEqual({});

    runtime.ensureStudioShellBackendApi();
    runtime.ensureStudioShellBackendApi();

    expect(created.workflowRunSummaryRepository ?? 0).toBe(0);
    expect(created.listWorkflowRunSummariesUseCase ?? 0).toBe(0);
    expect(created.studioShellRepository).toBe(1);
    expect(created.workflowPersistenceRepository).toBe(1);
    expect(created.imageRunHistoryRepository).toBe(1);
    expect(created.imageWorkflowSystemPersistence).toBe(1);
    expect(created.studioShellBackendApi).toBe(1);
    expect(created.systemStudioBackendApi ?? 0).toBe(0);
    expect(created.systemRuntimeBackendApi ?? 0).toBe(0);

    runtime.ensureWorkflowRunHistory();
    runtime.ensureWorkflowRunHistory();

    expect(created.workflowRunSummaryRepository).toBe(1);
    expect(created.listWorkflowRunSummariesUseCase).toBe(1);

    runtime.ensureSystemStudioBackendApi();
    runtime.ensureSystemRuntimeBackendApi();

    expect(created.systemStudioBackendApi).toBe(1);
    expect(created.systemRuntimeExecutionStore).toBe(1);
    expect(created.systemRuntimeExecutionAuditRepository).toBe(1);
    expect(created.systemRuntimeBackendApi).toBe(1);
  });

  it("disposes lazily created disposable dependencies", () => {
    const disposed: string[] = [];
    const createDisposable = (name: string) => ({
      dispose() {
        disposed.push(name);
      },
    });

    const runtime = createDeferredDesktopFeatureRuntime({
      storagePaths: {
        databasePath: "db.sqlite",
        storageDirectory: "storage",
        assetsDirectory: "assets",
      } as DesktopStoragePaths,
      runtimeConfigValues: createRuntimeConfigValues(),
      repoRoot: "C:/repo",
      factories: {
        createWorkflowPersistence: () => ({} as never),
        createExecutionRunRepository: () => createDisposable("execution-run-repo") as never,
        createExecutionHistoryInfrastructure: () => ({
          executionRunProjectionService: {},
          executionRunDetailProjectionService: {},
          listExecutionRunsUseCase: {},
          listRelatedExecutionRunsUseCase: {},
          getExecutionRunDetailUseCase: {},
        } as never),
        createGetExecutionRunUseCase: () => ({} as never),
        createWorkflowRunSummaryRepository: () => createDisposable("workflow-run-summary-repo") as never,
        createListWorkflowRunSummariesUseCase: () => ({} as never),
        createStudioShellRepository: () => createDisposable("studio-shell-repo") as never,
        createWorkflowPersistenceRepository: () => createDisposable("workflow-persistence-repo") as never,
        createImageRunHistoryRepository: () => ({} as never),
        createImageWorkflowSystemPersistence: () => createDisposable("image-workflow-system-persistence") as never,
        createStudioShellBackendApi: () => ({} as never),
        createSystemStudioBackendApi: () => ({} as never),
        createSystemRuntimeExecutionStore: () => ({} as never),
        createSystemRuntimeExecutionAuditRepository: () => ({} as never),
        createSystemRuntimeBackendApi: () => ({} as never),
      },
    });

    runtime.ensureExecutionHistory();
    runtime.ensureStudioShellBackendApi();
    runtime.ensureWorkflowRunHistory();
    runtime.dispose();

    expect(disposed).toEqual([
      "execution-run-repo",
      "workflow-run-summary-repo",
      "studio-shell-repo",
      "workflow-persistence-repo",
      "image-workflow-system-persistence",
    ]);
  });

  it("injects runtime observability logger into deferred system runtime backend", async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "ai-loom-deferred-runtime-observability-"));
    const storageDirectory = path.join(tempRoot, "storage");
    const assetsDirectory = path.join(tempRoot, "assets");
    mkdirSync(storageDirectory, { recursive: true });
    mkdirSync(assetsDirectory, { recursive: true });
    const logger = new CapturingSystemRuntimeObservabilityLogger();

    try {
      const runtime = createDeferredDesktopFeatureRuntime({
        storagePaths: {
          databasePath: path.join(storageDirectory, "desktop.sqlite"),
          storageDirectory,
          assetsDirectory,
        } as DesktopStoragePaths,
        runtimeConfigValues: createRuntimeConfigValues(),
        repoRoot: tempRoot,
        observabilityLogger: logger,
      });
      try {
        const systemRuntimeBackendApi = runtime.ensureSystemRuntimeBackendApi();
        const response = await systemRuntimeBackendApi.startExecution({});
        expect(response.ok).toBeFalse();
        expect(logger.warnEvents.some((event) =>
          event.action === "start-execution" && event.outcome === "rejected")).toBeTrue();
      } finally {
        runtime.dispose();
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
