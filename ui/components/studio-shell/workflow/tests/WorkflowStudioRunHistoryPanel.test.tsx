import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  applyWorkflowRunFiltersAndSort,
} from "../WorkflowStudioRunHistoryPanel";
import WorkflowStudioRunHistoryPanel from "../WorkflowStudioRunHistoryPanel";

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
});

function installBridge(overrides: {
  readonly listWorkflowRuns?: (requestJson: string) => Promise<string>;
  readonly getWorkflowRunDetail?: (runId: string) => Promise<string>;
} = {}): void {
  const listWorkflowRuns = overrides.listWorkflowRuns ?? (async () => JSON.stringify({
    ok: true,
    data: [
      {
        runId: "run:1",
        workflowId: "asset:workflow-1",
        workflowName: "Workflow One",
        status: "completed",
        triggerSource: "manual",
        startedAt: "2026-03-31T12:00:00.000Z",
        endedAt: "2026-03-31T12:00:07.000Z",
        updatedAt: "2026-03-31T12:00:07.000Z",
        durationMs: 7000,
        outputCount: 1,
        executionRunId: "run:1",
      },
    ],
  }));
  const getWorkflowRunDetail = overrides.getWorkflowRunDetail ?? (async () => JSON.stringify({
    ok: true,
    data: {
      runId: "run:1",
      summary: {
        runId: "run:1",
        workflowId: "asset:workflow-1",
        workflowName: "Workflow One",
        status: "completed",
        triggerSource: "manual",
        startedAt: "2026-03-31T12:00:00.000Z",
        endedAt: "2026-03-31T12:00:07.000Z",
        updatedAt: "2026-03-31T12:00:07.000Z",
        durationMs: 7000,
        outputCount: 1,
        executionRunId: "run:1",
      },
      stepRuns: [],
      executionContext: {
        resolvedTriggerContext: { source: "manual" },
      },
      outputs: {
        outputAssetIds: ["asset:output-1"],
        outputCount: 1,
        outputValues: {
          status: "completed",
          answer: "ok",
        },
      },
    },
  }));

  (globalThis as { window?: Window }).window = {
    aiLoomDesktop: {
      studioShell: {
        initializeStudio: async () => JSON.stringify({ ok: true }),
        loadSnapshot: async () => JSON.stringify({ ok: true }),
        startSession: async () => JSON.stringify({ ok: true }),
        createDraft: async () => JSON.stringify({ ok: true }),
        updateDraft: async () => JSON.stringify({ ok: true }),
        updateDependencies: async () => JSON.stringify({ ok: true }),
        transitionLifecycle: async () => JSON.stringify({ ok: true }),
        publishVersion: async () => JSON.stringify({ ok: true }),
        validateDraft: async () => JSON.stringify({ ok: true, data: [] }),
        getPersistedWorkflow: async () => JSON.stringify({ ok: true }),
        duplicatePersistedWorkflow: async () => JSON.stringify({ ok: true }),
        assessWorkflowExecutionReadiness: async () => JSON.stringify({ ok: true }),
        runWorkflowDraft: async () => JSON.stringify({ ok: true }),
        listWorkflowRuns,
        getWorkflowRunDetail,
        listSystemChildComponents: async () => JSON.stringify({ ok: true, data: [] }),
        addSystemChildComponent: async () => JSON.stringify({ ok: true }),
        removeSystemChildComponent: async () => JSON.stringify({ ok: true }),
        reorderSystemChildComponent: async () => JSON.stringify({ ok: true }),
        updateSystemInterfaces: async () => JSON.stringify({ ok: true }),
        updateSystemParameters: async () => JSON.stringify({ ok: true }),
        updateSystemExecutionMetadata: async () => JSON.stringify({ ok: true }),
        getSystemCompatibilityInsights: async () => JSON.stringify({ ok: true }),
        startSystemExecution: async () => JSON.stringify({ ok: true }),
        getSystemExecutionStatus: async () => JSON.stringify({ ok: true }),
        getSystemExecutionTrace: async () => JSON.stringify({ ok: true }),
        getSystemExecutionResult: async () => JSON.stringify({ ok: true }),
      },
    },
  } as Window;
}

describe("WorkflowStudioRunHistoryPanel", () => {
  it("applies status filtering and duration sorting for run summaries", () => {
    const sorted = applyWorkflowRunFiltersAndSort([
      {
        runId: "run:a",
        workflowId: "asset:workflow-1",
        workflowName: "Workflow One",
        status: "completed",
        triggerSource: "manual",
        startedAt: "2026-03-31T12:00:00.000Z",
        endedAt: "2026-03-31T12:00:10.000Z",
        updatedAt: "2026-03-31T12:00:10.000Z",
        durationMs: 10_000,
        executionRunId: "run:a",
      },
      {
        runId: "run:b",
        workflowId: "asset:workflow-1",
        workflowName: "Workflow One",
        status: "failed",
        triggerSource: "manual",
        startedAt: "2026-03-31T13:00:00.000Z",
        endedAt: "2026-03-31T13:00:03.000Z",
        updatedAt: "2026-03-31T13:00:03.000Z",
        durationMs: 3_000,
        executionRunId: "run:b",
      },
      {
        runId: "run:c",
        workflowId: "asset:workflow-1",
        workflowName: "Workflow One",
        status: "completed",
        triggerSource: "manual",
        startedAt: "2026-03-31T14:00:00.000Z",
        endedAt: "2026-03-31T14:00:01.000Z",
        updatedAt: "2026-03-31T14:00:01.000Z",
        durationMs: 1_000,
        executionRunId: "run:c",
      },
    ], "completed", "duration");

    expect(sorted.map((entry) => entry.runId)).toEqual(["run:a", "run:c"]);
  });

  it("renders save guidance when no persisted workflow id is available", () => {
    installBridge();
    const html = renderToString(
      <MemoryRouter initialEntries={["/studio-shell/workflow"]}>
        <Routes>
          <Route path="/studio-shell/workflow" element={<WorkflowStudioRunHistoryPanel />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain("Save this workflow draft to enable persisted run history.");
  });

  it("shows loading state while fetching run summaries", () => {
    installBridge({
      listWorkflowRuns: async () => new Promise<string>(() => {
        // Intentionally unresolved to keep initial loading state.
      }),
    });

    const html = renderToString(
      <MemoryRouter initialEntries={["/studio-shell/workflow/runs"]}>
        <Routes>
          <Route path="/studio-shell/workflow/runs" element={<WorkflowStudioRunHistoryPanel workflowId="asset:workflow-1" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain("Loading workflow runs...");
  });

  it("shows detail loading state when the route targets a specific run", () => {
    installBridge({
      getWorkflowRunDetail: async () => JSON.stringify({
        ok: false,
        error: {
          code: "not-found",
          message: "missing",
        },
      }),
    });

    const html = renderToString(
      <MemoryRouter initialEntries={["/studio-shell/workflow/runs/run:missing"]}>
        <Routes>
          <Route path="/studio-shell/workflow/runs/:runId" element={<WorkflowStudioRunHistoryPanel workflowId="asset:workflow-1" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain("Loading workflow runs...");
    expect(html).toContain("Loading run detail...");
  });
});
