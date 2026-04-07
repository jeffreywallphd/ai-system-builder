import { describe, expect, it } from "bun:test";
import {
  appendExecutionTraceEvent,
  appendRuntimeExecutionError,
  attachExecutionNode,
  createExecutionTraceSnapshot,
  createSystemExecution,
  decideRecoveryAction,
  ExecutionDecisionKinds,
  ExecutionLogLevels,
  ExecutionTraceEventKinds,
  ExecutionNodeStatusKinds,
  ExecutionStatusKinds,
  initializeExecutionRuntimeState,
  isTerminalExecutionStatus,
  propagateExecutionFailure,
  RecoveryActionKinds,
  RuntimeExecutionErrorKinds,
  transitionSystemExecutionStatus,
  updateExecutionNodeState,
} from "../SystemRuntimeDomain";

describe("SystemRuntimeDomain", () => {
  it("keeps runtime execution state separate from asset-definition models", () => {
    const execution = createSystemExecution({
      executionId: "exec-1",
      root: {
        assetId: "asset:system-root",
        versionId: "asset:system-root:v1",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "iterative",
        },
      },
      input: {
        payload: { prompt: "hello" },
        capturedAt: "2026-03-28T00:00:00.000Z",
      },
      startedAt: "2026-03-28T00:00:00.000Z",
    });

    expect(execution.executionId).toBe("exec-1");
    expect((execution as any).metadata).toBeUndefined();
    expect(execution.root.assetId).toBe("asset:system-root");
    expect(execution.status).toBe(ExecutionStatusKinds.pending);
  });

  it("references atomic/composite/system assets through execution nodes", () => {
    const execution = createSystemExecution({
      executionId: "exec-2",
      root: {
        assetId: "asset:system-root",
        versionId: "asset:system-root:v2",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "autonomous",
        },
      },
      nodes: [
        {
          executionNodeId: "node-atomic",
          path: ["node-atomic"],
          target: {
            assetId: "asset:model",
            versionId: "asset:model:v1",
            taxonomy: {
              structuralKind: "atomic",
              semanticRole: "model",
              behaviorKind: "none",
            },
          },
        },
        {
          executionNodeId: "node-composite",
          path: ["node-composite"],
          target: {
            assetId: "asset:workflow",
            versionId: "asset:workflow:v5",
            taxonomy: {
              structuralKind: "composite",
              semanticRole: "workflow",
              behaviorKind: "conditional",
            },
          },
        },
      ],
      input: {
        payload: { query: "state" },
        capturedAt: "2026-03-28T00:00:00.000Z",
      },
      startedAt: "2026-03-28T00:00:00.000Z",
    });

    expect(execution.nodes.map((entry) => entry.target.taxonomy.structuralKind)).toEqual(["atomic", "composite"]);
    const withSystemNode = attachExecutionNode({
      execution,
      node: {
        executionNodeId: "node-system-child",
        parentExecutionNodeId: "node-composite",
        path: ["node-composite", "node-system-child"],
        target: {
          assetId: "asset:system-child",
          versionId: "asset:system-child:v1",
          taxonomy: {
            structuralKind: "system",
            semanticRole: "system",
            behaviorKind: "deterministic",
          },
        },
      },
      updatedAt: "2026-03-28T00:01:00.000Z",
    });

    expect(withSystemNode.nodes[2]?.target.taxonomy.structuralKind).toBe("system");
    expect(withSystemNode.nodes[2]?.parentExecutionNodeId).toBe("node-composite");
  });

  it("enforces coherent execution status transitions", () => {
    const pending = createSystemExecution({
      executionId: "exec-3",
      root: {
        assetId: "asset:workflow",
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "iterative",
        },
      },
      input: {
        payload: { seed: 42 },
        capturedAt: "2026-03-28T10:00:00.000Z",
      },
      startedAt: "2026-03-28T10:00:00.000Z",
    });

    const running = transitionSystemExecutionStatus({
      execution: pending,
      nextStatus: ExecutionStatusKinds.running,
      updatedAt: "2026-03-28T10:00:30.000Z",
    });
    const succeeded = transitionSystemExecutionStatus({
      execution: running,
      nextStatus: ExecutionStatusKinds.succeeded,
      updatedAt: "2026-03-28T10:01:00.000Z",
      output: {
        payload: { ok: true },
        producedAt: "2026-03-28T10:01:00.000Z",
      },
    });

    expect(running.status).toBe("running");
    expect(succeeded.status).toBe("succeeded");
    expect(isTerminalExecutionStatus(succeeded.status)).toBe(true);
    expect(() => transitionSystemExecutionStatus({
      execution: succeeded,
      nextStatus: ExecutionStatusKinds.running,
      updatedAt: "2026-03-28T10:02:00.000Z",
    })).toThrow("cannot transition");
  });

  it("supports nested-system-ready node references without orchestration", () => {
    const execution = createSystemExecution({
      executionId: "exec-4",
      root: {
        assetId: "asset:system-root",
        versionId: "asset:system-root:v3",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "app-template",
          behaviorKind: "conditional",
        },
      },
      nodes: [
        {
          executionNodeId: "root-system-node",
          path: ["root-system-node"],
          target: {
            assetId: "asset:system-root",
            versionId: "asset:system-root:v3",
            taxonomy: {
              structuralKind: "system",
              semanticRole: "app-template",
              behaviorKind: "conditional",
            },
          },
        },
      ],
      input: {
        payload: { requestId: "req-1" },
        capturedAt: "2026-03-28T12:00:00.000Z",
      },
      startedAt: "2026-03-28T12:00:00.000Z",
    });

    const nested = attachExecutionNode({
      execution,
      node: {
        executionNodeId: "nested-system-node",
        parentExecutionNodeId: "root-system-node",
        path: ["root-system-node", "nested-system-node"],
        target: {
          assetId: "asset:system-child",
          versionId: "asset:system-child:v9",
          taxonomy: {
            structuralKind: "system",
            semanticRole: "system",
            behaviorKind: "autonomous",
          },
        },
      },
      updatedAt: "2026-03-28T12:00:10.000Z",
    });

    expect(nested.nodes).toHaveLength(2);
    expect(nested.nodes[1]?.path).toEqual(["root-system-node", "nested-system-node"]);
    expect(nested.nodes[1]?.target.assetId).toBe("asset:system-child");
  });

  it("tracks typed runtime state transitions for node progression", () => {
    const base = createSystemExecution({
      executionId: "exec-state",
      root: {
        assetId: "asset:system-root",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "autonomous",
        },
      },
      input: {
        payload: {},
        capturedAt: "2026-03-28T13:00:00.000Z",
      },
      startedAt: "2026-03-28T13:00:00.000Z",
    });

    const initialized = initializeExecutionRuntimeState({
      execution: base,
      nodeIds: ["node:root", "node:child"],
      updatedAt: "2026-03-28T13:00:05.000Z",
    });
    const running = updateExecutionNodeState({
      execution: initialized,
      executionNodeId: "node:root",
      status: ExecutionNodeStatusKinds.running,
      updatedAt: "2026-03-28T13:00:10.000Z",
      startedAt: "2026-03-28T13:00:10.000Z",
      incrementIteration: true,
      decision: {
        kind: ExecutionDecisionKinds.iterate,
        reason: "bounded-loop",
        decidedAt: "2026-03-28T13:00:10.000Z",
      },
    });
    const complete = updateExecutionNodeState({
      execution: running,
      executionNodeId: "node:root",
      status: ExecutionNodeStatusKinds.succeeded,
      updatedAt: "2026-03-28T13:00:20.000Z",
      completedAt: "2026-03-28T13:00:20.000Z",
      incrementPlanningCycle: true,
      decision: {
        kind: ExecutionDecisionKinds.complete,
        decidedAt: "2026-03-28T13:00:20.000Z",
      },
    });

    expect(initialized.runtimeState.snapshot.totalNodeCount).toBe(2);
    expect(complete.runtimeState.snapshot.completedNodeCount).toBe(1);
    expect(complete.runtimeState.nodeStates.find((entry) => entry.executionNodeId === "node:root")?.iterationCount).toBe(1);
    expect(complete.runtimeState.nodeStates.find((entry) => entry.executionNodeId === "node:root")?.planningCycleCount).toBe(1);
  });

  it("records typed trace events and snapshots for execution and node progression", () => {
    const base = createSystemExecution({
      executionId: "exec-trace",
      root: {
        assetId: "asset:system-root",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
      input: {
        payload: { request: true },
        capturedAt: "2026-03-28T14:00:00.000Z",
      },
      startedAt: "2026-03-28T14:00:00.000Z",
    });

    const traced = appendExecutionTraceEvent({
      execution: base,
      event: {
        eventId: "exec-trace:event:1",
        kind: ExecutionTraceEventKinds.nodeStatusChanged,
        at: "2026-03-28T14:00:01.000Z",
        executionId: "exec-trace",
        nodeId: "node:root",
        status: "running",
        summary: "root running",
      },
      logEntry: {
        entryId: "exec-trace:log:1",
        level: ExecutionLogLevels.info,
        message: "root running",
        emittedAt: "2026-03-28T14:00:01.000Z",
        nodeId: "node:root",
      },
    });
    const snapshot = createExecutionTraceSnapshot(traced);

    expect(snapshot.events.some((event) => event.kind === "execution-created")).toBe(true);
    expect(snapshot.events.some((event) => event.nodeId === "node:root")).toBe(true);
    expect(snapshot.logs[0]?.level).toBe("info");
  });

  it("applies bounded recovery decisions and failure propagation", () => {
    const base = createSystemExecution({
      executionId: "exec-error",
      root: {
        assetId: "asset:system-root",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "iterative",
        },
      },
      input: {
        payload: {},
        capturedAt: "2026-03-28T15:00:00.000Z",
      },
      startedAt: "2026-03-28T15:00:00.000Z",
    });
    const running = transitionSystemExecutionStatus({
      execution: base,
      nextStatus: ExecutionStatusKinds.running,
      updatedAt: "2026-03-28T15:00:01.000Z",
    });
    const withError = appendRuntimeExecutionError({
      execution: running,
      error: {
        errorId: "exec-error:error:1",
        kind: RuntimeExecutionErrorKinds.stepFailure,
        code: "step-transient-failure",
        message: "Transient network failure.",
        at: "2026-03-28T15:00:02.000Z",
        executionId: "exec-error",
        nodeId: "node:root",
        retriable: true,
      },
    });

    const retryDecision = decideRecoveryAction({
      error: withError.runtimeState.errors[0]!,
      retryCount: 0,
      maxRetries: 1,
    });
    expect(retryDecision.action).toBe(RecoveryActionKinds.retryStep);

    const failDecision = decideRecoveryAction({
      error: withError.runtimeState.errors[0]!,
      retryCount: 1,
      maxRetries: 1,
    });
    const failed = propagateExecutionFailure({
      execution: withError,
      error: withError.runtimeState.errors[0]!,
      decision: failDecision,
      updatedAt: "2026-03-28T15:00:03.000Z",
    });

    expect(failDecision.action).toBe(RecoveryActionKinds.failExecution);
    expect(failed.status).toBe("failed");
    expect(failed.runtimeState.trace.events.some((event) => event.kind === "recovery-decided")).toBe(true);
  });
});
