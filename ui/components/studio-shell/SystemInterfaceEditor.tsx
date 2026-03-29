import { useEffect, useState } from "react";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";

interface SystemSpecContent {
  readonly inputs?: ReadonlyArray<{ readonly inputId: string; readonly description?: string; readonly valueType?: string; readonly required?: boolean }>;
  readonly outputs?: ReadonlyArray<{ readonly outputId: string; readonly description?: string; readonly valueType?: string }>;
}

interface JsonParseResult<T> {
  readonly ok: boolean;
  readonly data?: T;
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

function parseJson<T>(value: string): JsonParseResult<T> {
  try {
    if (!value.trim()) {
      return Object.freeze({ ok: true, data: undefined as T | undefined });
    }
    return Object.freeze({ ok: true, data: JSON.parse(value) as T });
  } catch {
    return Object.freeze({ ok: false });
  }
}

export function SystemInterfaceEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const spec = draft ? parseSystemSpec(draft.content) : {};

  const [inputs, setInputs] = useState(spec.inputs ?? []);
  const [outputs, setOutputs] = useState(spec.outputs ?? []);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [inputsJson, setInputsJson] = useState(JSON.stringify(spec.inputs ?? [], null, 2));
  const [outputsJson, setOutputsJson] = useState(JSON.stringify(spec.outputs ?? [], null, 2));
  const [jsonError, setJsonError] = useState<string | undefined>();

  useEffect(() => {
    const nextInputs = spec.inputs ?? [];
    const nextOutputs = spec.outputs ?? [];
    setInputs(nextInputs);
    setOutputs(nextOutputs);
    setInputsJson(JSON.stringify(nextInputs, null, 2));
    setOutputsJson(JSON.stringify(nextOutputs, null, 2));
    setIsJsonMode(false);
    setJsonError(undefined);
  }, [draft?.draftId, draft?.revision]);

  const updateInputs = (nextInputs: ReadonlyArray<{ readonly inputId: string; readonly description?: string; readonly valueType?: string; readonly required?: boolean }>): void => {
    setInputs(nextInputs);
    setInputsJson(JSON.stringify(nextInputs, null, 2));
  };

  const updateOutputs = (nextOutputs: ReadonlyArray<{ readonly outputId: string; readonly description?: string; readonly valueType?: string }>): void => {
    setOutputs(nextOutputs);
    setOutputsJson(JSON.stringify(nextOutputs, null, 2));
  };

  const resolvePayload = (): {
    readonly inputs: ReadonlyArray<{ readonly inputId: string; readonly description?: string; readonly valueType?: string; readonly required?: boolean }>;
    readonly outputs: ReadonlyArray<{ readonly outputId: string; readonly description?: string; readonly valueType?: string }>;
  } | undefined => {
    if (!isJsonMode) {
      return Object.freeze({ inputs, outputs });
    }

    const parsedInputs = parseJson<Array<{ inputId: string; description?: string; valueType?: string; required?: boolean }>>(inputsJson);
    const parsedOutputs = parseJson<Array<{ outputId: string; description?: string; valueType?: string }>>(outputsJson);
    if (!parsedInputs.ok || !parsedOutputs.ok) {
      setJsonError("Inputs or outputs JSON is invalid. Fix JSON before saving.");
      return undefined;
    }
    setJsonError(undefined);
    return Object.freeze({
      inputs: parsedInputs.data ?? [],
      outputs: parsedOutputs.data ?? [],
    });
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-interface-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System inputs and outputs</strong>
        <span className="ui-text-small ui-text-secondary">
          Author explicit system interface definitions through backend-authoritative System Studio updates.
        </span>
      </div>

      <div className="ui-form-json-toggle">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={() => {
            if (!isJsonMode) {
              setInputsJson(JSON.stringify(inputs, null, 2));
              setOutputsJson(JSON.stringify(outputs, null, 2));
              setIsJsonMode(true);
              setJsonError(undefined);
              return;
            }

            const parsedInputs = parseJson<Array<{ inputId: string; description?: string; valueType?: string; required?: boolean }>>(inputsJson);
            const parsedOutputs = parseJson<Array<{ outputId: string; description?: string; valueType?: string }>>(outputsJson);
            if (!parsedInputs.ok || !parsedOutputs.ok) {
              setJsonError("Inputs or outputs JSON is invalid. Fix JSON before leaving advanced mode.");
              return;
            }

            const nextInputs = parsedInputs.data ?? [];
            const nextOutputs = parsedOutputs.data ?? [];
            setInputs(nextInputs);
            setOutputs(nextOutputs);
            setInputsJson(JSON.stringify(nextInputs, null, 2));
            setOutputsJson(JSON.stringify(nextOutputs, null, 2));
            setJsonError(undefined);
            setIsJsonMode(false);
          }}
        >
          {isJsonMode ? "Use Form Editor" : "Edit JSON"}
        </button>
      </div>

      {isJsonMode ? (
        <>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small">Inputs JSON</span>
            <textarea className="ui-textarea" rows={6} value={inputsJson} onChange={(event) => setInputsJson(event.target.value)} />
          </label>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small">Outputs JSON</span>
            <textarea className="ui-textarea" rows={6} value={outputsJson} onChange={(event) => setOutputsJson(event.target.value)} />
          </label>
        </>
      ) : (
        <>
          <div className="ui-form-array">
            <div className="ui-form-array__header">
              <strong>Inputs</strong>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => updateInputs([...inputs, { inputId: "", description: "", valueType: "", required: false }])}
              >
                Add input
              </button>
            </div>
            {inputs.map((entry, index) => (
              <div key={`input-${index}`} className="ui-form-array__row">
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Input ID</span>
                    <input
                      className="ui-input"
                      value={entry.inputId}
                      onChange={(event) => {
                        const next = [...inputs];
                        next[index] = { ...entry, inputId: event.target.value };
                        updateInputs(next);
                      }}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Value type</span>
                    <input
                      className="ui-input"
                      value={entry.valueType ?? ""}
                      onChange={(event) => {
                        const next = [...inputs];
                        next[index] = { ...entry, valueType: event.target.value };
                        updateInputs(next);
                      }}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Description</span>
                    <input
                      className="ui-input"
                      value={entry.description ?? ""}
                      onChange={(event) => {
                        const next = [...inputs];
                        next[index] = { ...entry, description: event.target.value };
                        updateInputs(next);
                      }}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Required</span>
                    <input
                      type="checkbox"
                      className="ui-checkbox"
                      checked={entry.required ?? false}
                      onChange={(event) => {
                        const next = [...inputs];
                        next[index] = { ...entry, required: event.target.checked };
                        updateInputs(next);
                      }}
                    />
                  </label>
                </div>
                <div className="ui-row ui-row--end">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => updateInputs(inputs.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="ui-form-array">
            <div className="ui-form-array__header">
              <strong>Outputs</strong>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => updateOutputs([...outputs, { outputId: "", description: "", valueType: "" }])}
              >
                Add output
              </button>
            </div>
            {outputs.map((entry, index) => (
              <div key={`output-${index}`} className="ui-form-array__row">
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Output ID</span>
                    <input
                      className="ui-input"
                      value={entry.outputId}
                      onChange={(event) => {
                        const next = [...outputs];
                        next[index] = { ...entry, outputId: event.target.value };
                        updateOutputs(next);
                      }}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Value type</span>
                    <input
                      className="ui-input"
                      value={entry.valueType ?? ""}
                      onChange={(event) => {
                        const next = [...outputs];
                        next[index] = { ...entry, valueType: event.target.value };
                        updateOutputs(next);
                      }}
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Description</span>
                    <input
                      className="ui-input"
                      value={entry.description ?? ""}
                      onChange={(event) => {
                        const next = [...outputs];
                        next[index] = { ...entry, description: event.target.value };
                        updateOutputs(next);
                      }}
                    />
                  </label>
                </div>
                <div className="ui-row ui-row--end">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => updateOutputs(outputs.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {jsonError ? <p className="ui-text-muted">{jsonError}</p> : null}

      <div className="ui-stack ui-stack--xs" style={{ flexDirection: "row" }}>
        <button
          className="ui-button"
          disabled={!draft || !sessionId || context.isBusy}
          onClick={() => {
            if (!draft || !sessionId) {
              return;
            }
            const payload = resolvePayload();
            if (!payload) {
              return;
            }
            void context.operations.updateSystemInterfaces?.({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              inputs: payload.inputs,
              outputs: payload.outputs,
            });
          }}
        >
          Save Interfaces
        </button>
      </div>
    </div>
  );
}
