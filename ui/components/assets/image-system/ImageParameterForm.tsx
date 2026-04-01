import { useEffect, useMemo, useState, type JSX } from "react";
import type {
  ImageParameterDefinition,
  ImageParameterFormEventContract,
  ImageParameterFormPropsContract,
  ImageParameterValidationIssue,
} from "./ImageUiContracts";

export interface ImageParameterFormProps extends ImageParameterFormPropsContract, ImageParameterFormEventContract {
  readonly title?: string;
  readonly className?: string;
}

function getDefaultValue(definition: ImageParameterDefinition): unknown {
  if (definition.defaultValue !== undefined) {
    return definition.defaultValue;
  }
  if (definition.type === "boolean") {
    return false;
  }
  if (definition.type === "number" || definition.type === "range") {
    return definition.min ?? 0;
  }
  if (definition.type === "select") {
    return definition.options?.[0]?.value ?? "";
  }
  return "";
}

function createInitialValues(input: ImageParameterFormPropsContract): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const definition of input.parameters) {
    values[definition.parameterId] = input.initialValues?.[definition.parameterId] ?? getDefaultValue(definition);
  }
  return Object.freeze(values);
}

function validateValues(
  parameters: ReadonlyArray<ImageParameterDefinition>,
  values: Readonly<Record<string, unknown>>,
): ReadonlyArray<ImageParameterValidationIssue> {
  const issues: ImageParameterValidationIssue[] = [];
  for (const definition of parameters) {
    const value = values[definition.parameterId];
    if (definition.required && (value === undefined || value === null || value === "")) {
      issues.push({ parameterId: definition.parameterId, code: "required", message: `${definition.label} is required.` });
      continue;
    }
    if ((definition.type === "number" || definition.type === "range") && value !== undefined && value !== "") {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        issues.push({ parameterId: definition.parameterId, code: "invalid-type", message: `${definition.label} must be numeric.` });
        continue;
      }
      if (typeof definition.min === "number" && numericValue < definition.min) {
        issues.push({ parameterId: definition.parameterId, code: "below-min", message: `${definition.label} must be >= ${definition.min}.` });
      }
      if (typeof definition.max === "number" && numericValue > definition.max) {
        issues.push({ parameterId: definition.parameterId, code: "above-max", message: `${definition.label} must be <= ${definition.max}.` });
      }
    }
    if (definition.type === "select" && definition.options?.length) {
      const allowed = new Set(definition.options.map((option) => option.value));
      if (!allowed.has(String(value ?? ""))) {
        issues.push({ parameterId: definition.parameterId, code: "invalid-option", message: `${definition.label} must use a supported option.` });
      }
    }
  }
  return Object.freeze(issues);
}

export function ImageParameterForm({
  imageId,
  parameters,
  initialValues,
  onParametersChanged,
  title = "Parameters",
  className,
}: ImageParameterFormProps): JSX.Element {
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>(() => createInitialValues({ imageId, parameters, initialValues }));

  useEffect(() => {
    setValues(createInitialValues({ imageId, parameters, initialValues }));
  }, [imageId, initialValues, parameters]);

  const issues = useMemo(() => validateValues(parameters, values), [parameters, values]);
  const issueMap = useMemo(() => {
    const map = new Map<string, ImageParameterValidationIssue>();
    issues.forEach((issue) => {
      if (!map.has(issue.parameterId)) {
        map.set(issue.parameterId, issue);
      }
    });
    return map;
  }, [issues]);

  useEffect(() => {
    onParametersChanged?.({ imageId, values, issues });
  }, [imageId, issues, onParametersChanged, values]);

  return (
    <section className={["ui-image-parameter-form", className ?? ""].filter(Boolean).join(" ")}>
      <header className="ui-image-parameter-form__header">
        <h3 className="ui-image-parameter-form__title">{title}</h3>
      </header>
      <div className="ui-form-grid">
        {parameters.map((parameter) => {
          const issue = issueMap.get(parameter.parameterId);
          const fieldId = `image-param-${parameter.parameterId}`;
          return (
            <label key={parameter.parameterId} className="ui-stack ui-stack--2xs" htmlFor={fieldId}>
              <span className="ui-text-small">
                {parameter.label}
                {parameter.required ? <span className="ui-text-danger"> *</span> : null}
              </span>
              {parameter.type === "boolean" ? (
                <input
                  id={fieldId}
                  type="checkbox"
                  checked={Boolean(values[parameter.parameterId])}
                  onChange={(event) => setValues((current) => Object.freeze({ ...current, [parameter.parameterId]: event.target.checked }))}
                />
              ) : null}
              {parameter.type === "select" ? (
                <select
                  id={fieldId}
                  className="ui-select"
                  value={String(values[parameter.parameterId] ?? "")}
                  onChange={(event) => setValues((current) => Object.freeze({ ...current, [parameter.parameterId]: event.target.value }))}
                >
                  {parameter.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : null}
              {parameter.type === "range" ? (
                <div className="ui-image-parameter-form__range">
                  <input
                    id={fieldId}
                    className="ui-slider"
                    type="range"
                    min={parameter.min}
                    max={parameter.max}
                    step={parameter.step ?? 1}
                    value={Number(values[parameter.parameterId] ?? parameter.min ?? 0)}
                    onChange={(event) => setValues((current) => Object.freeze({ ...current, [parameter.parameterId]: Number(event.target.value) }))}
                  />
                  <span className="ui-text-small ui-text-secondary">{String(values[parameter.parameterId] ?? "")}</span>
                </div>
              ) : null}
              {(parameter.type === "text" || parameter.type === "number") ? (
                <input
                  id={fieldId}
                  className="ui-input"
                  type={parameter.type === "number" ? "number" : "text"}
                  min={parameter.min}
                  max={parameter.max}
                  step={parameter.step}
                  placeholder={parameter.placeholder}
                  value={String(values[parameter.parameterId] ?? "")}
                  onChange={(event) => {
                    const nextValue = parameter.type === "number"
                      ? (event.target.value === "" ? "" : Number(event.target.value))
                      : event.target.value;
                    setValues((current) => Object.freeze({ ...current, [parameter.parameterId]: nextValue }));
                  }}
                />
              ) : null}
              {parameter.description ? <span className="ui-text-small ui-text-secondary">{parameter.description}</span> : null}
              {issue ? <span className="ui-text-small ui-text-danger">{issue.message}</span> : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
