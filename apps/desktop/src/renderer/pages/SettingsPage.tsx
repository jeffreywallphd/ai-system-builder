import { useState } from "react";

import { CollapsiblePanel } from "../components/ui/CollapsiblePanel";
import { SettingsPanel } from "../features/settings";

export function SettingsPage() {
  const [runtimeExpanded, setRuntimeExpanded] = useState(false);
  const [datasetExpanded, setDatasetExpanded] = useState(false);
  const [publishingExpanded, setPublishingExpanded] = useState(false);

  return (
    <section className="ui-stack ui-stack--sm">
      <h1>Settings</h1>
      <p className="ui-text-muted">Manage global desktop defaults used by feature workflows.</p>
      <SettingsPanel title="Hugging Face" category="huggingface" />
      <SettingsPanel title="Models" category="models" />
      <CollapsiblePanel
        title="Runtime settings"
        isExpanded={runtimeExpanded}
        onToggle={() => setRuntimeExpanded((expanded) => !expanded)}
      >
        {runtimeExpanded ? <SettingsPanel title="Runtime" category="runtime" /> : <p>Open this section to load runtime defaults.</p>}
      </CollapsiblePanel>
      <CollapsiblePanel
        title="Dataset preparation settings"
        isExpanded={datasetExpanded}
        onToggle={() => setDatasetExpanded((expanded) => !expanded)}
      >
        {datasetExpanded ? <SettingsPanel title="Dataset Preparation" category="datasetPreparation" /> : <p>Open this section to load dataset preparation defaults.</p>}
      </CollapsiblePanel>
      <CollapsiblePanel
        title="Publishing settings"
        isExpanded={publishingExpanded}
        onToggle={() => setPublishingExpanded((expanded) => !expanded)}
      >
        {publishingExpanded ? <SettingsPanel title="Publishing" category="publishing" /> : <p>Open this section to load publishing defaults.</p>}
      </CollapsiblePanel>
    </section>
  );
}
