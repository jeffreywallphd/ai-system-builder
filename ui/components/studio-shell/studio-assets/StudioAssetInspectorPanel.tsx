import { useMemo } from "react";
import type { StudioAssetCompositionNode } from "../../../studio-shell/studio-assets/StudioAssetComposition";
import type { StudioAssetRegistry } from "../../../studio-shell/studio-assets/StudioAssetRegistry";
import {
  applyStudioAssetPropertySchemaDefaults,
  listVisibleStudioAssetPropertySections,
  updateStudioAssetConfigByField,
  validateStudioAssetPropertySchema,
} from "../../../studio-shell/studio-assets/StudioAssetPropertySchema";
import type { StudioAssetPropertyField } from "../../../studio-shell/studio-assets/StudioAssetContracts";

export interface StudioAssetInspectorPanelProps {
  readonly registry: StudioAssetRegistry;
  readonly selectedAssetNode?: StudioAssetCompositionNode;
  readonly onChangeNodeConfig?: (nextConfig: Readonly<Record<string, unknown>>) => void;
  readonly title?: string;
}

function coerceFieldValue(field: StudioAssetPropertyField, value: string): unknown {
  if (field.kind === "number") {
    if (!value.trim()) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (field.kind === "boolean") {
    return value === "true";
  }
  if (field.kind === "json") {
    if (!value.trim()) {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function getValueByPath(config: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, config);
}

export default function StudioAssetInspectorPanel({
  registry,
  selectedAssetNode,
  onChangeNodeConfig,
  title = "Asset Inspector",
}: StudioAssetInspectorPanelProps): JSX.Element {
  const registration = selectedAssetNode ? registry.getById(selectedAssetNode.assetId) : undefined;
  const propertySchema = registration?.contract.propsSchema.propertySchema;
  const baseConfig = useMemo(
    () => Object.freeze({ ...(selectedAssetNode?.config ?? {}) }),
    [selectedAssetNode?.config],
  );
  const resolvedConfig = propertySchema
    ? applyStudioAssetPropertySchemaDefaults({ schema: propertySchema, config: baseConfig })
    : baseConfig;
  const sections = propertySchema
    ? listVisibleStudioAssetPropertySections({ schema: propertySchema, config: resolvedConfig })
    : Object.freeze([]);
  const issues = propertySchema
    ? validateStudioAssetPropertySchema({ schema: propertySchema, config: resolvedConfig })
    : Object.freeze([]);

  const handleFieldChange = (field: StudioAssetPropertyField, rawValue: string): void => {
    if (!onChangeNodeConfig) {
      return;
    }
    const value = coerceFieldValue(field, rawValue);
    const nextConfig = updateStudioAssetConfigByField({
      config: resolvedConfig,
      fieldPath: field.path,
      value,
    });
    onChangeNodeConfig(nextConfig);
  };

  const renderField = (field: StudioAssetPropertyField): JSX.Element => {
    const fieldId = `asset-inspector-${selectedAssetNode?.nodeId ?? "none"}-${field.id}`;
    const currentValue = getValueByPath(resolvedConfig, field.path);
    const disabled = field.readOnly || !onChangeNodeConfig;
    if (field.kind === "boolean") {
      return (
        <label key={field.id} className="ui-field">
          <span className="ui-field__label">{field.label}</span>
          <select
            id={fieldId}
            className="ui-input"
            value={currentValue === true ? "true" : "false"}
            disabled={disabled}
            onChange={(event) => handleFieldChange(field, event.target.value)}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
          {field.helpText ? <span className="ui-text-small ui-text-secondary">{field.helpText}</span> : null}
        </label>
      );
    }

    if (field.kind === "select") {
      return (
        <label key={field.id} className="ui-field">
          <span className="ui-field__label">{field.label}</span>
          <select
            id={fieldId}
            className="ui-input"
            value={typeof currentValue === "string" ? currentValue : ""}
            disabled={disabled}
            onChange={(event) => handleFieldChange(field, event.target.value)}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {field.helpText ? <span className="ui-text-small ui-text-secondary">{field.helpText}</span> : null}
        </label>
      );
    }

    if (field.kind === "textarea" || field.kind === "json") {
      return (
        <label key={field.id} className="ui-field">
          <span className="ui-field__label">{field.label}</span>
          <textarea
            id={fieldId}
            className="ui-textarea"
            rows={field.kind === "json" ? 5 : 3}
            value={typeof currentValue === "string" ? currentValue : currentValue ? JSON.stringify(currentValue, null, 2) : ""}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(event) => handleFieldChange(field, event.target.value)}
          />
          {field.helpText ? <span className="ui-text-small ui-text-secondary">{field.helpText}</span> : null}
        </label>
      );
    }

    return (
      <label key={field.id} className="ui-field">
        <span className="ui-field__label">{field.label}</span>
        <input
          id={fieldId}
          className="ui-input"
          type={field.kind === "number" ? "number" : "text"}
          value={typeof currentValue === "number" || typeof currentValue === "string" ? String(currentValue) : ""}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => handleFieldChange(field, event.target.value)}
        />
        {field.helpText ? <span className="ui-text-small ui-text-secondary">{field.helpText}</span> : null}
      </label>
    );
  };

  return (
    <aside className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid="studio-asset-inspector-panel">
      <div className="ui-stack ui-stack--2xs">
        <strong>{title}</strong>
        <span className="ui-text-small ui-text-secondary">
          {registration ? "Edit the selected asset settings." : "Select an asset instance to view details and settings."}
        </span>
      </div>

      {registration && selectedAssetNode ? (
        <div className="ui-stack ui-stack--2xs">
          <span className="ui-text-small"><strong>{registration.metadata.title}</strong></span>
          <span className="ui-text-small ui-text-secondary">{registration.kind} · {registration.metadata.assetType}</span>
          {registration.metadata.summary ? (
            <span className="ui-text-small ui-text-secondary">{registration.metadata.summary}</span>
          ) : null}
        </div>
      ) : (
        <p className="ui-text-small ui-text-muted">No asset selected.</p>
      )}

      {registration && !propertySchema ? (
        <p className="ui-text-small ui-text-muted">
          This asset does not yet expose editable properties.
        </p>
      ) : null}

      {sections.map((section) => (
        <section key={section.id} className="ui-stack ui-stack--2xs">
          <strong className="ui-text-small">{section.label}</strong>
          {section.description ? <span className="ui-text-small ui-text-secondary">{section.description}</span> : null}
          <div className="ui-stack ui-stack--xs">
            {section.fields.map((field) => renderField(field))}
          </div>
        </section>
      ))}

      {issues.length > 0 ? (
        <div className="ui-panel ui-stack ui-stack--2xs">
          <strong className="ui-text-small">Please review</strong>
          <ul className="ui-text-small ui-text-secondary" style={{ margin: 0, paddingInlineStart: "1rem" }}>
            {issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
