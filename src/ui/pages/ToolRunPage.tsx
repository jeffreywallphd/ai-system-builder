import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { ExecutionRunProjection } from "../../application/execution/ExecutionRunProjectionService";
import ExecutionHistoryPanel from "../components/execution/ExecutionHistoryPanel";
import ToolRunView from "../components/tools/ToolRunView";
import { useUiDependencies } from "../composition/AppProviders";
import { buildInstalledModelOptions } from "../models/buildInstalledModelOptions";

export default function ToolRunPage(): JSX.Element {
  const { toolId = "" } = useParams<{ toolId: string }>();
  const { toolStore, modelStore, executionHistoryService } = useUiDependencies();
  const [state, setState] = useState(toolStore.getState());
  const [modelState, setModelState] = useState(modelStore.getState());
  const [executionHistory, setExecutionHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);

  useEffect(() => toolStore.subscribe(setState), [toolStore]);
  useEffect(() => modelStore.subscribe(setModelState), [modelStore]);
  useEffect(() => {
    void modelStore.refreshInstalled().catch(() => undefined);
    if (toolId) {
      void toolStore.loadTool(toolId);
    }
  }, [modelStore, toolId, toolStore]);

  useEffect(() => {
    const selectedTool = state.selectedTool;
    if (!selectedTool) {
      setExecutionHistory([]);
      return;
    }

    void executionHistoryService.listHistory({
      executionKind: "workflow",
      metadata: {
        toolId: selectedTool.id,
      },
      limit: 8,
    }).then(setExecutionHistory).catch(() => setExecutionHistory([]));
  }, [executionHistoryService, state.isRunning, state.runResult?.runId, state.selectedTool]);

  const availableModels = useMemo(() => buildInstalledModelOptions(modelState.installedModels), [modelState.installedModels]);

  if (!state.selectedTool) {
    return (
      <section className="ui-page">
        <p>Preparing tool…</p>
      </section>
    );
  }

  return (
    <section className="ui-page">
      <ToolRunView
        tool={state.selectedTool}
        isRunning={state.isRunning}
        result={state.runResult}
        availableModels={availableModels}
        onRun={(values) => {
          void toolStore.runTool(values);
        }}
      />

      <ExecutionHistoryPanel
        title="Tool execution history"
        subtitle="Durable execution-engine records for this published tool."
        items={executionHistory}
        emptyMessage="No durable tool executions have been recorded yet."
        executionHistoryService={executionHistoryService}
      />
    </section>
  );
}
