import { useEffect, useState } from "react";
import type { SystemExecutionMetadata } from "../../../domain/system-studio/SystemAssetDomain";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemSpecContent {
  readonly executionMetadata?: SystemExecutionMetadata;
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

export function SystemExecutionMetadataEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const spec = draft ? parseSystemSpec(draft.content) : {};
  const [metadataJson, setMetadataJson] = useState(JSON.stringify(spec.executionMetadata ?? {}, null, 2));

  useEffect(() => {
    setMetadataJson(JSON.stringify(spec.executionMetadata ?? {}, null, 2));
  }, [draft?.draftId, draft?.revision]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-execution-metadata-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System execution metadata</strong>
        <span className="ui-text-small ui-text-secondary">
          Author bounded runtime, orchestration, publish/export, execution profile, and operational metadata for system assets.
        </span>
      </div>
      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Execution metadata JSON</span>
        <textarea className="ui-textarea" rows={10} value={metadataJson} onChange={(event) => setMetadataJson(event.target.value)} />
      </label>
      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
        <button
          className="ui-button"
          disabled={!draft || !sessionId || context.isBusy}
          onClick={() => {
            if (!draft || !sessionId) {
              return;
            }
            const executionMetadata = JSON.parse(metadataJson) as SystemExecutionMetadata;
            void context.operations.updateSystemExecutionMetadata?.({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              executionMetadata,
            });
          }}
        >
          Save Execution Metadata
        </button>
      </div>
    </div>
  );
}
