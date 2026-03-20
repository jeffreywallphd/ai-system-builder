import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ToolRunView from "../components/tools/ToolRunView";
import { useUiDependencies } from "../composition/AppProviders";
import { buildInstalledModelOptions } from "../models/buildInstalledModelOptions";

export default function ToolRunPage(): JSX.Element {
  const { toolId = "" } = useParams<{ toolId: string }>();
  const { toolStore, modelStore } = useUiDependencies();
  const [state, setState] = useState(toolStore.getState());
  const [modelState, setModelState] = useState(modelStore.getState());

  useEffect(() => toolStore.subscribe(setState), [toolStore]);
  useEffect(() => modelStore.subscribe(setModelState), [modelStore]);
  useEffect(() => {
    void modelStore.refreshInstalled().catch(() => undefined);
    if (toolId) {
      void toolStore.loadTool(toolId);
    }
  }, [modelStore, toolId, toolStore]);

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
    </section>
  );
}
