import { useEffect, useState } from "react";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemSpecContent {
  readonly parameters?: ReadonlyArray<{
    readonly parameterId: string;
    readonly description?: string;
    readonly valueType?: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
  }>;
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

export function SystemParameterConfigEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const spec = draft ? parseSystemSpec(draft.content) : {};
  const [parametersJson, setParametersJson] = useState(JSON.stringify(spec.parameters ?? [], null, 2));

  useEffect(() => {
    setParametersJson(JSON.stringify(spec.parameters ?? [], null, 2));
  }, [draft?.draftId, draft?.revision]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-parameter-config-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System parameters and defaults</strong>
        <span className="ui-text-small ui-text-secondary">
          Author system parameters, required flags, and default configuration values through the real System Studio flow.
        </span>
      </div>
      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Parameters JSON</span>
        <textarea className="ui-textarea" rows={8} value={parametersJson} onChange={(event) => setParametersJson(event.target.value)} />
      </label>
      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
        <button
          className="ui-button"
          disabled={!draft || !sessionId || context.isBusy}
          onClick={() => {
            if (!draft || !sessionId) {
              return;
            }
            const parameters = JSON.parse(parametersJson) as ReadonlyArray<{
              readonly parameterId: string;
              readonly description?: string;
              readonly valueType?: string;
              readonly required?: boolean;
              readonly defaultValue?: unknown;
            }>;
            void context.operations.updateSystemParameters?.({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              parameters,
            });
          }}
        >
          Save Parameters
        </button>
      </div>
    </div>
  );
}
