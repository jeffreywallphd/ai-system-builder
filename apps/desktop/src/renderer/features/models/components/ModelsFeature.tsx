import { useState } from "react";

import { TabbedPanel } from "../../../components/ui/TabbedPanel";
import { PythonRuntimeFooter } from "../../python-runtime/components/PythonRuntimeFooter";
import type { DesktopModelsClient } from "../api/desktopModelsClient";
import { useModelsFeature } from "../hooks/useModelsFeature";
import { useModelTrainingFeature } from "../hooks/useModelTrainingFeature";
import { BrowseModelsTab } from "./BrowseModelsTab";
import { ManageModelsTab } from "./ManageModelsTab";
import { TrainModelTab } from "./TrainModelTab";

export function ModelsFeature(props: { client?: DesktopModelsClient; workspaceId?: string; workspaceName?: string }) {
  const state = useModelsFeature(props.client, props.workspaceId);
  const [activeTabId, setActiveTabId] = useState("browse-models");
  return (
    <section className="ui-panel ui-panel--elevated ui-stack ui-stack--sm">
      <TabbedPanel
        tabListAriaLabel="Model workspace panels"
        defaultTabId="browse-models"
        onTabChange={setActiveTabId}
        tabs={[
          {
            id: "browse-models",
            label: "Browse Models",
            content: <BrowseModelsTab state={state} />,
          },
          {
            id: "manage-models",
            label: "Manage Models",
            content: <ManageModelsTab state={state} />,
          },
          {
            id: "train-model",
            label: "Train Model",
            content: <DeferredTrainModelTab client={props.client} />,
          },
        ]}
      />
      <PythonRuntimeFooter enabled={activeTabId === "train-model"} />
    </section>
  );
}

function DeferredTrainModelTab({ client }: { client?: DesktopModelsClient }) {
  const trainingState = useModelTrainingFeature(client);
  return <TrainModelTab state={trainingState} />;
}
