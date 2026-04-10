import { describe, expect, it } from "bun:test";
import type { AppRuntimeConfigValues } from "../../../src/infrastructure/config/AppRuntimeConfig";
import type { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import { createDeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";

type DesktopStoragePaths = ReturnType<typeof resolveDesktopStoragePaths>;

function createRuntimeConfigValues(): AppRuntimeConfigValues {
  return {
    workflowStorageDirectory: "dev/workflow-data/workflows",
    workflowIndexDatabasePath: "dev/workflow-data/workflows/workflow-index.sqlite",
  } as AppRuntimeConfigValues;
}

describe("createDeferredDesktopFeatureRuntime", () => {
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

    expect(created.workflowRunSummaryRepository).toBe(1);
    expect(created.listWorkflowRunSummariesUseCase).toBe(1);
    expect(created.studioShellRepository).toBe(1);
    expect(created.workflowPersistenceRepository).toBe(1);
    expect(created.imageRunHistoryRepository).toBe(1);
    expect(created.imageWorkflowSystemPersistence).toBe(1);
    expect(created.studioShellBackendApi).toBe(1);
    expect(created.systemStudioBackendApi ?? 0).toBe(0);
    expect(created.systemRuntimeBackendApi ?? 0).toBe(0);

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
    runtime.dispose();

    expect(disposed).toEqual([
      "execution-run-repo",
      "workflow-run-summary-repo",
      "studio-shell-repo",
      "workflow-persistence-repo",
      "image-workflow-system-persistence",
    ]);
  });
});
