import type { JSX } from "react";
import type {
  StudioImageWorkflowDefinitionReadModel,
} from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import type { ImageWorkflowParameterSpecification } from "@domain/image-workflows/ImageWorkflowParameterSpecification";
import type { WorkflowParameterValidationPresentation } from "./SystemWorkflowParameterFormPresenter";
import { isWorkflowParameterVisible } from "./SystemWorkflowParameterFormPresenter";

export interface SystemWorkflowParameterFormProps {
  readonly workflow: StudioImageWorkflowDefinitionReadModel;
  readonly values: Readonly<Record<string, unknown>>;
  readonly validation: WorkflowParameterValidationPresentation;
  readonly busy?: boolean;
  readonly onValueChanged: (parameterId: string, value: unknown) => void;
  readonly onSaveRequested: () => void;
}

function toInputValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function renderParameterControl(input: {
  readonly specification: ImageWorkflowParameterSpecification;
  readonly value: unknown;
  readonly disabled: boolean;
  readonly onValueChanged: (value: unknown) => void;
}): JSX.Element {
  const { specification, value, disabled, onValueChanged } = input;
  if (specification.valueKind === "boolean") {
    return (
      <label className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <input
          type="checkbox"
          className="ui-checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onValueChanged(event.currentTarget.checked)}
        />
        <span className="ui-text-small">{specification.required ? "Required" : "Optional"}</span>
      </label>
    );
  }

  if (specification.valueKind === "select" && (specification.validation.options?.length ?? 0) > 0) {
    return (
      <select
        className="ui-select"
        value={toInputValue(value)}
        disabled={disabled}
        onChange={(event) => onValueChanged(event.currentTarget.value)}
      >
        <option value="">Choose an option</option>
        {specification.validation.options?.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  const isNumeric = specification.valueKind === "integer" || specification.valueKind === "float";
  const controlIsSlider = specification.ui.control === "slider" && isNumeric;
  if (controlIsSlider) {
    return (
      <div className="ui-stack ui-stack--2xs">
        <input
          className="ui-slider"
          type="range"
          min={specification.validation.minimum}
          max={specification.validation.maximum}
          step={specification.validation.step}
          disabled={disabled}
          value={toInputValue(value ?? specification.defaultValue ?? specification.validation.minimum ?? 0)}
          onChange={(event) => onValueChanged(event.currentTarget.value)}
        />
        <span className="ui-text-small ui-text-secondary">{toInputValue(value)}</span>
      </div>
    );
  }

  if (specification.ui.control === "text-area") {
    return (
      <textarea
        className="ui-textarea"
        rows={4}
        placeholder={specification.ui.placeholder}
        disabled={disabled}
        value={toInputValue(value)}
        onChange={(event) => onValueChanged(event.currentTarget.value)}
      />
    );
  }

  return (
    <input
      className="ui-input"
      type={isNumeric ? "number" : "text"}
      min={isNumeric ? specification.validation.minimum : undefined}
      max={isNumeric ? specification.validation.maximum : undefined}
      step={isNumeric ? specification.validation.step : undefined}
      placeholder={specification.ui.placeholder}
      disabled={disabled}
      value={toInputValue(value)}
      onChange={(event) => onValueChanged(event.currentTarget.value)}
    />
  );
}

export default function SystemWorkflowParameterForm({
  workflow,
  values,
  validation,
  busy = false,
  onValueChanged,
  onSaveRequested,
}: SystemWorkflowParameterFormProps): JSX.Element {
  const orderedParameters = [...workflow.parameterSpecifications].sort((left, right) => {
    const leftOrder = left.ui.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.ui.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.parameterId.localeCompare(right.parameterId);
  });

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-workflow-parameter-form">
      <div className="ui-stack ui-stack--2xs">
        <strong>Operation settings</strong>
        <span className="ui-text-small ui-text-secondary">
          Tune your workflow behavior using guided controls.
        </span>
      </div>
      {validation.globalIssues.length > 0 ? (
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          {validation.globalIssues.map((issue, index) => (
            <span key={`${issue.parameterId}-${issue.code}-${index}`} className="ui-text-small ui-text-danger">
              {issue.message}
            </span>
          ))}
        </div>
      ) : null}
      <div className="ui-form-grid">
        {orderedParameters.map((specification) => {
          if (specification.ui.control === "hidden") {
            return null;
          }
          const isVisible = isWorkflowParameterVisible(specification, values);
          const issues = validation.issuesByParameterId.get(specification.parameterId) ?? [];
          return (
            <label key={specification.parameterId} className="ui-field">
              <span className="ui-field__label">
                {specification.label}
                {specification.required ? " *" : ""}
              </span>
              {renderParameterControl({
                specification,
                value: values[specification.parameterId],
                disabled: busy || !isVisible,
                onValueChanged: (value) => onValueChanged(specification.parameterId, value),
              })}
              {specification.ui.helpText ? (
                <span className="ui-text-small ui-text-secondary">{specification.ui.helpText}</span>
              ) : null}
              {specification.description ? (
                <span className="ui-text-small ui-text-secondary">{specification.description}</span>
              ) : null}
              {!isVisible ? (
                <span className="ui-text-small ui-text-secondary">This setting becomes available when related options are set.</span>
              ) : null}
              {issues.map((issue, index) => (
                <span key={`${specification.parameterId}-${issue.code}-${index}`} className="ui-text-small ui-text-danger">
                  {issue.message}
                </span>
              ))}
            </label>
          );
        })}
      </div>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={busy}
          onClick={onSaveRequested}
        >
          Save operation settings
        </button>
        {validation.hasIssues ? (
          <span className="ui-text-small ui-text-secondary">Fix highlighted settings before saving.</span>
        ) : (
          <span className="ui-text-small ui-text-secondary">All settings look good.</span>
        )}
      </div>
    </section>
  );
}
