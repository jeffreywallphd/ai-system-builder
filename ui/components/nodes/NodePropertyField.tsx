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
            step={1}
            value={field.value ?? ""}
            disabled={isDisabled}
            onChange={(event) => {
              const raw = event.target.value;
              emit(raw === "" ? undefined : Math.trunc(Number(raw)));
            }}
          />
        );

      case "number":
      case "slider":
        return (
          <input
            className="ui-input"
            type="number"
            value={field.value ?? ""}
            disabled={isDisabled}
            onChange={(event) => {
              const raw = event.target.value;
              emit(raw === "" ? undefined : Number(raw));
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

      case "text":
      case "template":
      case "file":
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
          </div>

          <div className="ui-chips">
            <span className="ui-badge ui-badge--neutral">{field.type}</span>
            {field.isAdvanced ? <span className="ui-badge ui-badge--warning">Advanced</span> : null}
            {!field.isEditable ? <span className="ui-badge ui-badge--danger">Read Only</span> : null}
            {field.isEmpty ? <span className="ui-badge ui-badge--info">Empty</span> : null}
          </div>
        </div>

        {renderControl()}
      </div>
    </div>
  );
}
