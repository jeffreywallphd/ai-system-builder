import { useEffect, useMemo, useState } from "react";
import type { CanonicalRecordValue } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { DataAssetConfigFieldKinds, resolveDataAssetConfigDefaults, type DataAssetConfigFieldSchema, type DataAssetConfigSchema } from "../../../application/dataset-studio/DataAssetConfiguration";
import type { DataStudioValidationIssue } from "../../../application/dataset-studio/DataStudioValidation";

export interface AssetConfigurationPanelProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly schema?: DataAssetConfigSchema;
  readonly initialConfig?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly issues?: ReadonlyArray<DataStudioValidationIssue>;
  readonly isApplying?: boolean;
  readonly disabled?: boolean;
  readonly emptyMessage?: string;
  readonly onApply?: (config: Readonly<Record<string, CanonicalRecordValue>>) => void;
  readonly onConfigChange?: (config: Readonly<Record<string, CanonicalRecordValue>>) => void;
}

function normalizeRecord(value: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key.trim(), entry] as const)
      .filter(([key]) => key.length > 0),
  ));
}

function toJsonText(value: CanonicalRecordValue | undefined): string {
  if (value === undefined) {
    return "{}";
  }
  return JSON.stringify(value, null, 2);
}

function createIssueMap(issues: ReadonlyArray<DataStudioValidationIssue>): ReadonlyMap<string, ReadonlyArray<DataStudioValidationIssue>> {
  const grouped = new Map<string, DataStudioValidationIssue[]>();
  for (const issue of issues) {
    const path = issue.path?.trim();
    if (!path || !path.startsWith("config.values.")) {
      continue;
    }

    const key = path.slice("config.values.".length);
    const group = grouped.get(key) ?? [];
    group.push(issue);
    grouped.set(key, group);
  }

  return new Map([...grouped.entries()].map(([key, value]) => [key, Object.freeze(value)] as const));
}

function renderField(input: {
  readonly field: DataAssetConfigFieldSchema;
  readonly value: CanonicalRecordValue | undefined;
  readonly disabled: boolean;
  readonly issues: ReadonlyArray<DataStudioValidationIssue>;
  readonly onChange: (value: CanonicalRecordValue) => void;
}): JSX.Element {
  const { field } = input;

  if (field.kind === DataAssetConfigFieldKinds.boolean) {
    const checked = input.value === true;
    return (
      <label className="ui-field" key={field.key} data-testid={`asset-config-field-${field.key}`}>
        <span className="ui-field__label">{field.label}</span>
        <span className="ui-row ui-row--wrap">
          <input
            type="checkbox"
            className="ui-checkbox"
            checked={checked}
            disabled={input.disabled}
            onChange={(event) => input.onChange(event.currentTarget.checked)}
          />
          <span>{field.description ?? "Enabled"}</span>
        </span>
        {input.issues.map((issue, index) => (
          <span key={`${issue.code}-${index}`} className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
            {issue.message}
          </span>
        ))}
      </label>
    );
  }

  if (field.kind === DataAssetConfigFieldKinds.select) {
    const value = typeof input.value === "string" ? input.value : String(field.defaultValue ?? "");
    return (
      <label className="ui-field" key={field.key} data-testid={`asset-config-field-${field.key}`}>
        <span className="ui-field__label">{field.label}</span>
        <select
          className="ui-select"
          value={value}
          disabled={input.disabled}
          onChange={(event) => input.onChange(event.currentTarget.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
        {input.issues.map((issue, index) => (
          <span key={`${issue.code}-${index}`} className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
            {issue.message}
          </span>
        ))}
      </label>
    );
  }

  if (field.kind === DataAssetConfigFieldKinds.number) {
    const value = typeof input.value === "number" ? input.value : Number(field.defaultValue ?? 0);
    return (
      <label className="ui-field" key={field.key} data-testid={`asset-config-field-${field.key}`}>
        <span className="ui-field__label">{field.label}</span>
        <input
          type="number"
          className="ui-input"
          value={Number.isFinite(value) ? value : 0}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          disabled={input.disabled}
          onChange={(event) => input.onChange(Number(event.currentTarget.value))}
        />
        {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
        {input.issues.map((issue, index) => (
          <span key={`${issue.code}-${index}`} className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
            {issue.message}
          </span>
        ))}
      </label>
    );
  }

  if (field.kind === DataAssetConfigFieldKinds.json) {
    const value = toJsonText(input.value);
    return (
      <label className="ui-field" key={field.key} data-testid={`asset-config-field-${field.key}`}>
        <span className="ui-field__label">{field.label}</span>
        <textarea
          className="ui-textarea ui-text-mono"
          value={value}
          placeholder={field.placeholder}
          disabled={input.disabled}
          onChange={(event) => {
            try {
              input.onChange(JSON.parse(event.currentTarget.value) as CanonicalRecordValue);
            } catch {
              input.onChange(event.currentTarget.value);
            }
          }}
        />
        {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
        {input.issues.map((issue, index) => (
          <span key={`${issue.code}-${index}`} className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
            {issue.message}
          </span>
        ))}
      </label>
    );
  }

  const value = typeof input.value === "string" ? input.value : String(input.value ?? "");
  return (
    <label className="ui-field" key={field.key} data-testid={`asset-config-field-${field.key}`}>
      <span className="ui-field__label">{field.label}</span>
      <input
        type="text"
        className="ui-input"
        value={value}
        placeholder={field.placeholder}
        disabled={input.disabled}
        onChange={(event) => input.onChange(event.currentTarget.value)}
      />
      {field.description ? <span className="ui-field__hint">{field.description}</span> : null}
      {input.issues.map((issue, index) => (
        <span key={`${issue.code}-${index}`} className={issue.severity === "error" ? "ui-text-danger" : "ui-subtle"}>
          {issue.message}
        </span>
      ))}
    </label>
  );
}

export default function AssetConfigurationPanel({
  title = "Asset Configuration",
  subtitle = "Schema-driven configuration for the selected data asset.",
  schema,
  initialConfig,
  issues = Object.freeze([]),
  isApplying = false,
  disabled = false,
  emptyMessage = "No configuration schema is available for this data asset.",
  onApply,
  onConfigChange,
}: AssetConfigurationPanelProps): JSX.Element {
  const normalizedInitial = useMemo(() => {
    if (!schema) {
      return Object.freeze({}) as Readonly<Record<string, CanonicalRecordValue>>;
    }

    return normalizeRecord(resolveDataAssetConfigDefaults(schema, initialConfig));
  }, [initialConfig, schema]);

  const [draftConfig, setDraftConfig] = useState<Readonly<Record<string, CanonicalRecordValue>>(normalizedInitial);
  useEffect(() => {
    setDraftConfig(normalizedInitial);
  }, [normalizedInitial]);

  const issueMap = useMemo(() => createIssueMap(issues), [issues]);
  const hasSchema = Boolean(schema && schema.fields.length > 0);
  const isDirty = JSON.stringify(draftConfig) !== JSON.stringify(normalizedInitial);

  if (!hasSchema) {
    return (
      <section className="ui-card ui-card--padded ui-stack ui-stack--xs" data-testid="asset-config-panel-empty">
        <strong>{title}</strong>
        <div className="ui-subtle">{emptyMessage}</div>
      </section>
    );
  }

  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid="asset-config-panel">
      <header className="ui-stack ui-stack--2xs">
        <strong>{title}</strong>
        <span className="ui-subtle">{subtitle}</span>
        <div className="ui-row ui-row--wrap">
          <span className="ui-badge ui-badge--neutral">{schema?.schemaId}</span>
          {errorCount > 0 ? <span className="ui-badge ui-badge--danger">{errorCount} errors</span> : null}
          {warningCount > 0 ? <span className="ui-badge ui-badge--warning">{warningCount} warnings</span> : null}
        </div>
      </header>

      <div className="ui-form-grid ui-form-grid--single">
        {(schema?.fields ?? []).map((field) => renderField({
          field,
          value: draftConfig[field.key],
          disabled: disabled || isApplying,
          issues: issueMap.get(field.key) ?? Object.freeze([]),
          onChange: (value) => {
            const next = normalizeRecord({
              ...draftConfig,
              [field.key]: value,
            });
            setDraftConfig(next);
            onConfigChange?.(next);
          },
        }))}
      </div>

      <div className="ui-row ui-row--between ui-row--wrap">
        <button
          type="button"
          className="ui-button ui-button--ghost"
          disabled={!isDirty || isApplying || disabled}
          onClick={() => {
            setDraftConfig(normalizedInitial);
            onConfigChange?.(normalizedInitial);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className="ui-button"
          disabled={!isDirty || isApplying || disabled}
          onClick={() => onApply?.(draftConfig)}
        >
          {isApplying ? "Applying..." : "Apply"}
        </button>
      </div>
    </section>
  );
}
