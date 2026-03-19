import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ToolRunView from "../components/tools/ToolRunView";
import { useUiDependencies } from "../composition/AppProviders";

export default function ToolRunPage(): JSX.Element {
  const { toolId = "" } = useParams<{ toolId: string }>();
  const { toolStore } = useUiDependencies();
  const [state, setState] = useState(toolStore.getState());

  useEffect(() => toolStore.subscribe(setState), [toolStore]);
  useEffect(() => {
    if (toolId) {
      void toolStore.loadTool(toolId);
    }
  }, [toolId, toolStore]);

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
        onRun={(values) => {
          void toolStore.runTool(values);
        }}
      />
    </section>
  );
}
