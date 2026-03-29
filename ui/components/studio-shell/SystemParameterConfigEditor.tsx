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

interface EditableParameter {
  readonly parameterId: string;
  readonly description: string;
  readonly valueType: string;
  readonly required: boolean;
  readonly defaultValue: string;
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

function toEditableParameters(
  parameters: ReadonlyArray<{
    readonly parameterId: string;
    readonly description?: string;
    readonly valueType?: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
  }>,
): ReadonlyArray<EditableParameter> {
  if (parameters.length === 0) {
    return Object.freeze([{ parameterId: "", description: "", valueType: "", required: false, defaultValue: "" }]);
  }
  return Object.freeze(parameters.map((parameter) => ({
    parameterId: parameter.parameterId,
    description: parameter.description ?? "",
    valueType: parameter.valueType ?? "",
    required: parameter.required ?? false,
    defaultValue: parameter.defaultValue === undefined ? "" : JSON.stringify(parameter.defaultValue),
  })));
}

function toParameters(
  parameters: ReadonlyArray<EditableParameter>,
): ReadonlyArray<{
  readonly parameterId: string;
  readonly description?: string;
  readonly valueType?: string;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
}> {
  return Object.freeze(
    parameters
      .map((parameter) => ({
        parameterId: parameter.parameterId.trim(),
        description: parameter.description.trim(),
        valueType: parameter.valueType.trim(),
        required: parameter.required,
        defaultValue: parameter.defaultValue.trim(),
      }))
      .filter((parameter) => parameter.parameterId.length > 0)
      .map((parameter) => {
        const parsedDefaultValue = parseJson<unknown>(parameter.defaultValue);
        const defaultValue = parameter.defaultValue.length === 0
          ? undefined
          : parsedDefaultValue.ok
            ? parsedDefaultValue.data
            : parameter.defaultValue;
        return {
          parameterId: parameter.parameterId,
          description: parameter.description || undefined,
          valueType: parameter.valueType || undefined,
          required: parameter.required,
          defaultValue,
        };
      }),
  );
}

export function SystemParameterConfigEditor({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const spec = draft ? parseSystemSpec(draft.content) : {};

  const [parameters, setParameters] = useState<ReadonlyArray<EditableParameter>>(toEditableParameters(spec.parameters ?? []));
  const [parametersJson, setParametersJson] = useState(JSON.stringify(spec.parameters ?? [], null, 2));
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonError, setJsonError] = useState<string | undefined>();

  useEffect(() => {
    const nextParameters = toEditableParameters(spec.parameters ?? []);
    setParameters(nextParameters);
    setParametersJson(JSON.stringify(spec.parameters ?? [], null, 2));
    setIsJsonMode(false);
    setJsonError(undefined);
  }, [draft?.draftId, draft?.revision]);

  const updateParameters = (nextParameters: ReadonlyArray<EditableParameter>): void => {
    setParameters(nextParameters);
    setParametersJson(JSON.stringify(toParameters(nextParameters), null, 2));
  };

  const resolvePayload = (): ReadonlyArray<{
    readonly parameterId: string;
    readonly description?: string;
    readonly valueType?: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
  }> | undefined => {
    if (!isJsonMode) {
      return toParameters(parameters);
    }

    const parsed = parseJson<Array<{
      parameterId: string;
      description?: string;
      valueType?: string;
      required?: boolean;
      defaultValue?: unknown;
    }>>(parametersJson);
    if (!parsed.ok) {
      setJsonError("Parameters JSON is invalid. Fix JSON before saving.");
      return undefined;
    }
    setJsonError(undefined);
    return parsed.data ?? [];
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-parameter-config-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System parameters and defaults</strong>
        <span className="ui-text-small ui-text-secondary">
          Author system parameters, required flags, and default configuration values through the real System Studio flow.
        </span>
      </div>

      <div className="ui-form-json-toggle">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={() => {
            if (!isJsonMode) {
              setParametersJson(JSON.stringify(toParameters(parameters), null, 2));
              setIsJsonMode(true);
              setJsonError(undefined);
              return;
            }

            const parsed = parseJson<Array<{
              parameterId: string;
              description?: string;
              valueType?: string;
              required?: boolean;
              defaultValue?: unknown;
            }>>(parametersJson);
            if (!parsed.ok) {
              setJsonError("Parameters JSON is invalid. Fix JSON before leaving advanced mode.");
              return;
            }
            const nextParameters = toEditableParameters(parsed.data ?? []);
            setParameters(nextParameters);
            setParametersJson(JSON.stringify(parsed.data ?? [], null, 2));
            setJsonError(undefined);
            setIsJsonMode(false);
          }}
        >
          {isJsonMode ? "Use Form Editor" : "Edit JSON"}
        </button>
      </div>

      {isJsonMode ? (
        <label className="ui-stack ui-stack--2xs">
          <span className="ui-text-small">Parameters JSON</span>
          <textarea className="ui-textarea" rows={8} value={parametersJson} onChange={(event) => setParametersJson(event.target.value)} />
        </label>
      ) : (
        <div className="ui-form-array">
          <div className="ui-form-array__header">
            <strong>Parameters</strong>
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => updateParameters([...parameters, { parameterId: "", description: "", valueType: "", required: false, defaultValue: "" }])}
            >
              Add parameter
            </button>
          </div>
          {parameters.map((parameter, index) => (
            <div key={`parameter-${index}`} className="ui-form-array__row">
              <div className="ui-form-grid">
                <label className="ui-field">
                  <span className="ui-field__label">Parameter ID</span>
                  <input
                    className="ui-input"
                    value={parameter.parameterId}
                    onChange={(event) => {
                      const next = [...parameters];
                      next[index] = { ...parameter, parameterId: event.target.value };
                      updateParameters(next);
                    }}
                  />
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Value type</span>
                  <input
                    className="ui-input"
                    value={parameter.valueType}
                    onChange={(event) => {
                      const next = [...parameters];
                      next[index] = { ...parameter, valueType: event.target.value };
                      updateParameters(next);
                    }}
                  />
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Description</span>
                  <input
                    className="ui-input"
                    value={parameter.description}
                    onChange={(event) => {
                      const next = [...parameters];
                      next[index] = { ...parameter, description: event.target.value };
                      updateParameters(next);
                    }}
                  />
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Required</span>
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    checked={parameter.required}
                    onChange={(event) => {
                      const next = [...parameters];
                      next[index] = { ...parameter, required: event.target.checked };
                      updateParameters(next);
                    }}
                  />
                </label>
              </div>
              <label className="ui-field">
                <span className="ui-field__label">Default value</span>
                <input
                  className="ui-input"
                  value={parameter.defaultValue}
                  onChange={(event) => {
                    const next = [...parameters];
                    next[index] = { ...parameter, defaultValue: event.target.value };
                    updateParameters(next);
                  }}
                />
              </label>
              <div className="ui-row ui-row--end">
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  onClick={() => {
                    const next = parameters.filter((_, itemIndex) => itemIndex !== index);
                    updateParameters(next.length > 0 ? next : [{ parameterId: "", description: "", valueType: "", required: false, defaultValue: "" }]);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
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
            void context.operations.updateSystemParameters?.({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
              parameters: payload,
            });
          }}
        >
          Save Parameters
        </button>
      </div>
    </div>
  );
}
