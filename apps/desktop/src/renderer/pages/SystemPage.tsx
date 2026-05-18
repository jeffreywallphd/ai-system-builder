import { useState } from "react";

import { CollapsiblePanel } from "../components/ui/CollapsiblePanel";
import { SectionErrorState } from "../components/ui/SectionErrorState";
import { SectionLoadingState } from "../components/ui/SectionLoadingState";
import { createDesktopImageGenerationClient } from "../features/image-generation/api";
import { PythonRuntimeFooter } from "../features/python-runtime/components/PythonRuntimeFooter";
import { useAsyncSection } from "../hooks/useAsyncSection";

export function SystemPage() {
  const [pythonExpanded, setPythonExpanded] = useState(false);
  const [comfyExpanded, setComfyExpanded] = useState(false);
  const comfyStatus = useAsyncSection({
    pageKey: "system",
    sectionKey: "system.comfyui-runtime",
    initialTrigger: "expanded",
    loadOnMount: false,
    loader: async () => {
      const imageGenerationClient = createDesktopImageGenerationClient();
      const result = await imageGenerationClient.readComfyUiInstallStatus({});
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value.status;
    },
  });

  return (
    <section className="ui-stack ui-stack--sm">
      <h1>System</h1>
      <p className="ui-text-muted">Inspect desktop host readiness and open runtime controls only when needed.</p>

      <section className="ui-panel ui-stack ui-stack--sm" aria-label="Basic app diagnostics">
        <h2 className="ui-panel__title">Basic diagnostics</h2>
        <p>The desktop shell is mounted. Runtime status panels below are deferred until opened.</p>
      </section>

      <section className="ui-panel ui-stack ui-stack--sm" aria-label="Runtime readiness summary">
        <h2 className="ui-panel__title">Runtime readiness</h2>
        <p>Python and ComfyUI controls are idle until you expand a runtime section or choose an explicit action.</p>
      </section>

      <CollapsiblePanel
        title="Python runtime controls"
        isExpanded={pythonExpanded}
        onToggle={() => setPythonExpanded((expanded) => !expanded)}
      >
        {pythonExpanded ? (
          <PythonRuntimeFooter enabled />
        ) : (
          <p>Open this section to read Python runtime status and logs. Start, stop, and restart remain explicit actions.</p>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="ComfyUI install status and repair"
        isExpanded={comfyExpanded}
        onToggle={() => {
          setComfyExpanded((expanded) => {
            const next = !expanded;
            if (next && comfyStatus.status === "idle") {
              void comfyStatus.load("expanded");
            }
            return next;
          });
        }}
      >
        {comfyStatus.status === "idle" ? <p>Open this section to check ComfyUI install status.</p> : null}
        {comfyStatus.status === "loading" ? <SectionLoadingState message="Loading ComfyUI install status..." /> : null}
        {comfyStatus.status === "error" ? <SectionErrorState message={comfyStatus.error ?? "Failed to load ComfyUI install status."} onRetry={() => { void comfyStatus.retry(); }} /> : null}
        {comfyStatus.status === "success" ? (
          <section className="ui-stack ui-stack--sm" aria-label="ComfyUI runtime status">
            <p>ComfyUI install status: <strong>{comfyStatus.data}</strong></p>
            <button className="ui-button" type="button" onClick={() => { void comfyStatus.load("refresh"); }}>Refresh</button>
          </section>
        ) : null}
      </CollapsiblePanel>
    </section>
  );
}
