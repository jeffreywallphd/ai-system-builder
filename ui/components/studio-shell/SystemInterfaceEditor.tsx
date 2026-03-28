import { useEffect, useState } from "react";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemSpecContent {
  readonly inputs?: ReadonlyArray<{ readonly inputId: string; readonly description?: string; readonly valueType?: string; readonly required?: boolean }>;
  readonly outputs?: ReadonlyArray<{ readonly outputId: string; readonly description?: string; readonly valueType?: string }>;
}

function parseSystemSpec(content: string): SystemSpecContent {
  try {
    if (!content.trim()) {
      return Object.freeze({});
    }
    const parsed = JSON.parse(content) as { readonly systemSpec?: SystemSpecContent };
    return parsed.systemSpec ?? Object.freeze({});
  } catch {
    return Object.freeze({});
  }
}

export function SystemInterfaceEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const spec = draft ? parseSystemSpec(draft.content) : {};
  const [inputsJson, setInputsJson] = useState(JSON.stringify(spec.inputs ?? [], null, 2));
  const [outputsJson, setOutputsJson] = useState(JSON.stringify(spec.outputs ?? [], null, 2));

  useEffect(() => {
    setInputsJson(JSON.stringify(spec.inputs ?? [], null, 2));
    setOutputsJson(JSON.stringify(spec.outputs ?? [], null, 2));
  }, [draft?.draftId, draft?.revision]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-interface-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System inputs and outputs</strong>
        <span className="ui-text-small ui-text-secondary">
          Author explicit system interface definitions through backend-authoritative System Studio updates.
        </span>
      </div>
      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Inputs JSON</span>
        <textarea className="ui-textarea" rows={6} value={inputsJson} onChange={(event) => setInputsJson(event.target.value)} />
      </label>
      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Outputs JSON</span>
        <textarea className="ui-textarea" rows={6} value={outputsJson} onChange={(event) => setOutputsJson(event.target.value)} />
      </label>
      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
        <button
          className="ui-button"
          disabled={!draft || !sessionId || context.isBusy}
          onClick={() => {
            if (!draft || !sessionId) {
              return;
            }
            const inputs = JSON.parse(inputsJson) as ReadonlyArray<{ readonly inputId: string; readonly description?: string; readonly valueType?: string; readonly required?: boolean }>;
            const outputs = JSON.parse(outputsJson) as ReadonlyArray<{ readonly outputId: string; readonly description?: string; readonly valueType?: string }>;
            void context.operations.updateSystemInterfaces?.({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              inputs,
              outputs,
            });
          }}
        >
          Save Interfaces
        </button>
      </div>
    </div>
  );
}
