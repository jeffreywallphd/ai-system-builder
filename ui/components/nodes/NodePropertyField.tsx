import type { NodePropertyFieldViewModel } from "../../presenters/NodePresenter";

export interface NodePropertyFieldProps {
  readonly field: NodePropertyFieldViewModel;
  readonly disabled?: boolean;
  readonly onChange?: (propertyId: string, value: unknown) => void;
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function sliderValue(field: NodePropertyFieldViewModel): number {
  if (typeof field.value === "number") {
    return field.value;
  }

  if (typeof field.defaultValue === "number") {
    return field.defaultValue;
  }

  if (typeof field.min === "number") {
    return field.min;
  }

  return 0;
}

function clampNumber(field: NodePropertyFieldViewModel, value: number): number {
  if (!field.shouldClampToRange) {
    return field.type === "integer" ? Math.trunc(value) : value;
  }

  const min = field.min ?? value;
  const max = field.max ?? value;
  const bounded = Math.min(max, Math.max(min, value));

  if (field.step && field.step > 0 && field.min !== undefined) {
    const stepCount = Math.round((bounded - field.min) / field.step);
    const stepped = field.min + stepCount * field.step;
    return field.type === "integer"
      ? Math.trunc(Math.min(max, Math.max(min, stepped)))
      : Math.min(max, Math.max(min, stepped));
  }

  return field.type === "integer" ? Math.trunc(bounded) : bounded;
}

export default function NodePropertyField({
  field,
  disabled,
  onChange,
}: NodePropertyFieldProps): JSX.Element {
  const isDisabled = disabled || !field.isEditable;

  const emit = (value: unknown): void => {
    onChange?.(field.id, value);
  };

  const renderControl = (): JSX.Element => {
    switch (field.type) {
      case "boolean":
        return (
          <label className="ui-row ui-row--wrap">
            <input
              className="ui-checkbox"
              type="checkbox"
              checked={Boolean(field.value)}
              disabled={isDisabled}
              onChange={(event) => emit(event.target.checked)}
            />
            <span className="ui-text-body">{Boolean(field.value) ? "Enabled" : "Disabled"}</span>
          </label>
        );

      case "integer":
        return (
          <input
            className="ui-input"
            type="number"
            step={field.step ?? 1}
            min={field.min}
            max={field.max}
            value={typeof field.value === "number" ? field.value : ""}
            disabled={isDisabled}
            onChange={(event) => {
              const raw = event.target.value;
              emit(raw === "" ? undefined : clampNumber(field, Number(raw)));
            }}
          />
        );

      case "slider":
        return (
          <div className="ui-stack ui-stack--xs">
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={sliderValue(field)}
              disabled={isDisabled}
              onChange={(event) => emit(clampNumber(field, Number(event.target.value)))}
            />
            <input
              className="ui-input"
              type="number"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={typeof field.value === "number" ? field.value : ""}
              disabled={isDisabled}
              onChange={(event) => {
                const raw = event.target.value;
                emit(raw === "" ? undefined : clampNumber(field, Number(raw)));
              }}
            />
          </div>
        );

      case "number":
        return (
          <input
            className="ui-input"
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? "any"}
            value={typeof field.value === "number" ? field.value : ""}
            disabled={isDisabled}
            onChange={(event) => {
              const raw = event.target.value;
              emit(raw === "" ? undefined : clampNumber(field, Number(raw)));
            }}
          />
        );

      case "select":
        return (
          <select
            className="ui-select"
            value={field.value === undefined || field.value === null ? "" : String(field.value)}
            disabled={isDisabled}
            onChange={(event) => emit(event.target.value || undefined)}
          >
            <option value="">Select…</option>
            {(field.options ?? []).map((option) => (
              <option key={`${field.id}-${String(option.value)}`} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "multiline-text":
      case "code":
      case "json":
        return (
          <textarea
            className="ui-textarea ui-text-mono"
            value={stringifyValue(field.value)}
            disabled={isDisabled}
            onChange={(event) => emit(event.target.value)}
          />
        );

      case "multi-select":
      case "model-list":
        return (
          <textarea
            className="ui-textarea"
            value={
              Array.isArray(field.value)
                ? field.value.map((item) => String(item)).join("\n")
                : stringifyValue(field.value)
            }
            disabled={isDisabled}
            onChange={(event) =>
              emit(
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
              )
            }
          />
        );

      case "file":
        return (
          <div className="ui-stack ui-stack--xs">
            <input
              className="ui-input"
              type="file"
              disabled={isDisabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  emit(undefined);
                  return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                  emit({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    text: typeof reader.result === "string" ? reader.result : "",
                  });
                };
                reader.onerror = () => {
                  emit({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    error: "Failed to read file contents.",
                  });
                };
                reader.readAsText(file);
              }}
            />
            {field.value ? (
              <div className="ui-text-small ui-subtle">Selected: {stringifyValue((field.value as { name?: string }).name ?? "document")}</div>
            ) : null}
          </div>
        );

      case "text":
      case "template":
      case "directory":
      case "model-reference":
      case "secret":
      case "color":
      case "date":
      case "duration":
      case "generic":
      default:
        return (
          <input
            className="ui-input"
            type="text"
            value={stringifyValue(field.value)}
            disabled={isDisabled}
            onChange={(event) => emit(event.target.value)}
          />
        );
    }
  };

  return (
    <div className="ui-card">
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-row ui-row--between ui-row--wrap">
          <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
            <label className="ui-field__label">{field.name}</label>
            {field.description ? <div className="ui-field__hint">{field.description}</div> : null}
            {field.min !== undefined || field.max !== undefined ? (
              <div className="ui-text-small ui-text-secondary">
                Range: {field.min ?? "-∞"} to {field.max ?? "∞"}
                {field.defaultValue !== undefined ? ` · Default: ${String(field.defaultValue)}` : ""}
              </div>
            ) : null}
          </div>

          <div className="ui-chips">
            <span className="ui-badge ui-badge--neutral">{field.type}</span>
            {field.isAdvanced ? <span className="ui-badge ui-badge--warning">Advanced</span> : null}
            {!field.isEditable ? <span className="ui-badge ui-badge--danger">Read Only</span> : null}
            {field.isEmpty ? <span className="ui-badge ui-badge--info">Empty</span> : null}
            {field.shouldClampToRange ? <span className="ui-badge ui-badge--neutral">Clamped</span> : null}
          </div>
        </div>

        {renderControl()}
      </div>
    </div>
  );
}
