import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import { createExecutionRunRepository, createUnifiedExecutionInfrastructure } from "../createExecutionInfrastructure";
import { DesktopBridgeExecutionRunRepository } from "../../browser/execution/DesktopBridgeExecutionRunRepository";
import { SqliteExecutionRunRepository } from "../../filesystem/execution/SqliteExecutionRunRepository";

describe("execution infrastructure composition", () => {
  it("prefers the desktop execution-run bridge when available and otherwise uses SQLite/file fallbacks", () => {
    const bridgeRepository = createExecutionRunRepository({
      desktopExecutionRunBridge: {
        saveExecutionRun: async () => undefined,
        loadExecutionRun: async () => null,
        listExecutionRuns: async () => [],
      },
    });
    const sqlitePath = path.join(tmpdir(), `loom-execution-composition-${Date.now()}.sqlite`);
    const sqliteRepository = createExecutionRunRepository({ sqliteDatabasePath: sqlitePath });

    expect(bridgeRepository).toBeInstanceOf(DesktopBridgeExecutionRunRepository);
    expect(sqliteRepository).toBeInstanceOf(SqliteExecutionRunRepository);
    (sqliteRepository as SqliteExecutionRunRepository).dispose();
    rmSync(sqlitePath, { force: true });
    rmSync(`${sqlitePath}-wal`, { force: true });
    rmSync(`${sqlitePath}-shm`, { force: true });
  });

  it("builds a unified execution engine with model-preparation handlers when that runtime is enabled", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-execution-composition-"));
    const savedRuns: unknown[] = [];
    const repository = {
      saveRun: async (run: unknown) => { savedRuns.push(run); return run; },
      getRunById: async () => undefined,
      listRuns: async () => [],
    };
    const engine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => { throw new Error("workflow path not used"); },
        startExecution: async () => { throw new Error("workflow path not used"); },
      },
      executionRunRepository: repository,
      modelTrainingRuntime: {
        submitJob: async (request) => Object.freeze({
          id: request.id,
          name: request.name,
          backend: "python-runtime-manifest" as const,
          executionKind: "preparation-only" as const,
          baseModelId: request.baseModelId,
          datasetId: request.datasetId,
          datasetVersionId: request.datasetVersionId,
          createdBy: request.createdBy,
          createdAt: new Date("2026-03-23T00:00:00.000Z"),
          updatedAt: new Date("2026-03-23T00:00:01.000Z"),
          completedAt: new Date("2026-03-23T00:00:01.000Z"),
          status: "exported-without-training" as const,
          configuration: request.configuration,
          diagnostics: [],
          artifacts: [],
          checkpoints: [],
          summary: "Prepared a truthful bundle.",
          provenance: {
            executionKind: "preparation-only" as const,
            backend: "python-runtime-manifest" as const,
            truthfulness: "exported-without-training" as const,
            runtime: "python-runtime" as const,
            runMode: "preparation-only" as const,
            supportsGradientTraining: false,
            isPreparationOnly: true,
            path: root,
            diagnostics: [],
            detail: "Prepared a bundle without gradient training.",
          },
        }),
        getJob: async () => undefined,
        refreshJob: async () => undefined,
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => { throw new Error("not used"); },
      },
    });

    try {
      const result = await engine.execute({
        plan: new ExecutionPlan({
          id: "model-preparation:job-1",
          units: [{ id: "model-preparation:job-1", kind: ExecutionUnitKinds.modelPreparation, label: "Prepare bundle" }],
        }),
        unitInputs: {
          "model-preparation:job-1": {
            id: "job-1",
            name: "Prepare bundle",
            executionKind: "preparation-only",
            baseModelId: "base-1",
            baseModelName: "Base One",
            datasetId: "dataset-1",
            datasetName: "Support QA",
            datasetVersionId: "version-1",
            datasetVersionNumber: 1,
            datasetTaskType: "question_answering",
            createdBy: "tester",
            configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
            examples: [],
          },
        },
        metadata: { executionKind: "model-preparation", baseModelId: "base-1" },
      });

      expect(result.status).toBe(ExecutionStatuses.completed);
      expect(result.run.metadata?.executionKind).toBe("model-preparation");
      expect(result.run.units["model-preparation:job-1"]?.outputSummary?.headline).toContain("Prepared");
      expect(savedRuns.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("builds a unified execution engine with truthful model-training handlers when that runtime is enabled", async () => {
    const savedRuns: unknown[] = [];
    let refreshCount = 0;
    const repository = {
      saveRun: async (run: unknown) => { savedRuns.push(run); return run; },
      getRunById: async () => undefined,
      listRuns: async () => [],
    };
    const engine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => { throw new Error("workflow path not used"); },
        startExecution: async () => { throw new Error("workflow path not used"); },
      },
      executionRunRepository: repository,
      modelTrainingRuntime: {
        submitJob: async (request) => Object.freeze({
          id: request.id,
          name: request.name,
          backend: "python-runtime-local" as const,
          executionKind: "local-gradient-training" as const,
          baseModelId: request.baseModelId,
          datasetId: request.datasetId,
          datasetVersionId: request.datasetVersionId,
          createdBy: request.createdBy,
          createdAt: new Date("2026-03-23T00:00:00.000Z"),
          updatedAt: new Date("2026-03-23T00:00:00.000Z"),
          submittedAt: new Date("2026-03-23T00:00:00.000Z"),
          status: "submitted" as const,
          configuration: request.configuration,
          diagnostics: [],
          artifacts: [],
          checkpoints: [],
          summary: "Submitted a real local training job.",
          progress: { percent: 0, currentEpoch: 0, totalEpochs: 1, currentStep: 0, totalSteps: 1, statusDetail: "Submitted." },
          provenance: {
            executionKind: "local-gradient-training" as const,
            backend: "python-runtime-local" as const,
            truthfulness: "real-execution" as const,
            runtime: "python-runtime" as const,
            runMode: "local-gradient-training" as const,
            supportsGradientTraining: true,
            isPreparationOnly: false,
            path: "/tmp/job-1",
            diagnostics: [],
            detail: "Real local gradient training.",
          },
        }),
        getJob: async () => undefined,
        refreshJob: async (jobId) => {
          refreshCount += 1;
          return Object.freeze({
            id: jobId,
            name: "Train adapter",
            backend: "python-runtime-local" as const,
            executionKind: "local-gradient-training" as const,
            baseModelId: "base-1",
            datasetId: "dataset-1",
            datasetVersionId: "version-1",
            createdBy: "tester",
            createdAt: new Date("2026-03-23T00:00:00.000Z"),
            updatedAt: new Date("2026-03-23T00:00:01.000Z"),
            submittedAt: new Date("2026-03-23T00:00:00.000Z"),
            completedAt: refreshCount >= 1 ? new Date("2026-03-23T00:00:01.000Z") : undefined,
            status: refreshCount >= 1 ? "completed" as const : "running" as const,
            configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
            diagnostics: [],
            artifacts: [],
            checkpoints: [],
            summary: refreshCount >= 1 ? "Completed a real local training run." : "Training in progress.",
            progress: { percent: refreshCount >= 1 ? 100 : 50, currentEpoch: 1, totalEpochs: 1, currentStep: 1, totalSteps: 1, statusDetail: refreshCount >= 1 ? "Training completed." : "Running epoch 1/1." },
            provenance: {
              executionKind: "local-gradient-training" as const,
              backend: "python-runtime-local" as const,
              truthfulness: "real-execution" as const,
              runtime: "python-runtime" as const,
              runMode: "local-gradient-training" as const,
              supportsGradientTraining: true,
              isPreparationOnly: false,
              path: "/tmp/job-1",
              diagnostics: [],
              detail: "Real local gradient training.",
            },
          });
        },
        reconcileJob: async () => undefined,
        listJobs: async () => [],
        cancelJob: async () => { throw new Error("not used"); },
      },
    });

    const handle = await engine.startExecution({
      plan: new ExecutionPlan({
        id: "model-training:job-1",
        units: [{ id: "model-training:job-1", kind: ExecutionUnitKinds.modelTraining, label: "Train adapter" }],
      }),
      unitInputs: {
        "model-training:job-1": {
          id: "job-1",
          name: "Train adapter",
          executionKind: "local-gradient-training",
          baseModelId: "base-1",
          baseModelName: "Base One",
          datasetId: "dataset-1",
          datasetName: "Support QA",
          datasetVersionId: "version-1",
          datasetVersionNumber: 1,
          datasetTaskType: "question_answering",
          createdBy: "tester",
          configuration: { epochs: 1, learningRate: 0.0001, batchSize: 1 },
          examples: [{ id: "example-1", taskType: "question_answering", inputText: "Q", targetText: "A" }],
        },
      },
      metadata: { executionKind: "model-training", baseModelId: "base-1" },
    });

    const result = await handle.waitForCompletion();

    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(result.run.metadata?.executionKind).toBe("model-training");
    expect(result.run.units["model-training:job-1"]?.outputSummary?.headline).toContain("Local training");
    expect(savedRuns.length).toBeGreaterThan(1);
  });

  it("builds a unified execution engine with MCP server-operation handlers when that runtime manager is enabled", async () => {
    const savedRuns: unknown[] = [];
    const engine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => { throw new Error("workflow path not used"); },
        startExecution: async () => { throw new Error("workflow path not used"); },
      },
      executionRunRepository: {
        saveRun: async (run: unknown) => {
          savedRuns.push(run);
          return run;
        },
        getRunById: async () => undefined,
        listRuns: async () => [],
      },
      mcpServerManager: {
        connectServer: async ({ serverId }) => ({
          action: "connect" as const,
          checkedAt: "2026-03-23T00:00:00.000Z",
          server: {
            id: serverId,
            name: "Local MCP",
            transport: "stdio" as const,
            enabled: true,
            status: "connected" as const,
            connected: true,
            toolCount: 2,
            resourceCount: 0,
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
          status: {
            serverId,
            name: "Local MCP",
            transport: "stdio" as const,
            configured: true,
            enabled: true,
            state: "connected" as const,
            lifecycleState: "running" as const,
            sessionState: "connected" as const,
            connected: true,
            checkedAt: "2026-03-23T00:00:00.000Z",
            toolCount: 2,
            resourceCount: 0,
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
          runtime: {
            enabled: true,
            state: "ready" as const,
            healthState: "healthy" as const,
            checkedAt: "2026-03-23T00:00:00.000Z",
            servers: [],
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
        }),
        disconnectServer: async () => { throw new Error("unused"); },
        reconnectServer: async () => { throw new Error("unused"); },
        createLocalServer: async () => { throw new Error("unused"); },
      },
    });

    const result = await engine.execute({
      plan: new ExecutionPlan({
        id: "mcp-server-operation:connect:local",
        units: [{ id: "mcp-server-operation:connect:local", kind: ExecutionUnitKinds.mcpServerOperation, label: "Connect MCP server" }],
      }),
      unitInputs: {
        "mcp-server-operation:connect:local": {
          action: "connect",
          serverId: "local",
        },
      },
      metadata: { executionKind: "mcp-server-operation", mcpAction: "connect", serverId: "local" },
    });

    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(result.run.metadata?.executionKind).toBe("mcp-server-operation");
    expect(result.run.units["mcp-server-operation:connect:local"]?.outputSummary?.headline).toContain("connected");
    expect(savedRuns.length).toBeGreaterThan(0);
  });
});
