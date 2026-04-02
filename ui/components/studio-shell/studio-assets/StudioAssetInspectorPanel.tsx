import { useMemo } from "react";
import type { StudioAssetCompositionNode } from "../../../studio-shell/studio-assets/StudioAssetComposition";
import type { StudioAssetRegistry } from "../../../studio-shell/studio-assets/StudioAssetRegistry";
import {
  listVisibleStudioAssetPropertySections,
  updateStudioAssetConfigByField,
  validateStudioAssetPropertySchema,
} from "../../../studio-shell/studio-assets/StudioAssetPropertySchema";
import type { StudioAssetPropertyField } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import type { StudioAssetSelectionState } from "../../../studio-shell/studio-assets/StudioAssetSelection";
import { bindStudioAssetSelection, createStudioAssetSelectionState, navigateStudioAssetSelectionToPathNode } from "../../../studio-shell/studio-assets/StudioAssetSelection";
import { resolveStudioAssetDefaultConfig } from "../../../studio-shell/studio-assets/StudioAssetDefaults";
import type { StudioAssetPreviewModel } from "../../../studio-shell/studio-assets/StudioAssetPreview";
import { createStudioAssetPreviewModel } from "../../../studio-shell/studio-assets/StudioAssetPreview";
import StudioAssetPreviewCard from "./StudioAssetPreviewCard";

export interface StudioAssetInspectorPanelProps {
  readonly registry: StudioAssetRegistry;
  readonly selectedAssetNode?: StudioAssetCompositionNode;
  readonly compositionRoot?: StudioAssetCompositionNode;
  readonly selection?: StudioAssetSelectionState;
  readonly onChangeNodeConfig?: (nextConfig: Readonly<Record<string, unknown>>) => void;
  readonly onChangeSelectedAssetNode?: (nextNode: StudioAssetCompositionNode) => void;
  readonly title?: string;
  readonly onChangeSelection?: (nextSelection: StudioAssetSelectionState) => void;
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
  compositionRoot,
  selection,
  onChangeNodeConfig,
  onChangeSelectedAssetNode,
  title = "Asset Inspector",
  onChangeSelection,
}: StudioAssetInspectorPanelProps): JSX.Element {
  const boundSelection = useMemo(
    () => bindStudioAssetSelection({ root: compositionRoot, selection }),
    [compositionRoot, selection],
  );
  const activeNode = boundSelection.selectedNode ?? selectedAssetNode;
  const registration = activeNode ? registry.getById(activeNode.assetId) : undefined;
  const propertySchema = registration?.contract.propsSchema.propertySchema;
  const resolvedConfig = useMemo(() => {
    if (!registration) {
      return Object.freeze({});
    }
    return resolveStudioAssetDefaultConfig({
      registration,
      config: activeNode?.config,
    }) ?? Object.freeze({});
  }, [registration, activeNode?.config]);
  const sections = propertySchema
    ? listVisibleStudioAssetPropertySections({ schema: propertySchema, config: resolvedConfig })
    : Object.freeze([]);
  const issues = propertySchema
    ? validateStudioAssetPropertySchema({ schema: propertySchema, config: resolvedConfig })
    : Object.freeze([]);

  const previewModel: StudioAssetPreviewModel | undefined = registration
    ? createStudioAssetPreviewModel({ registration, config: resolvedConfig })
    : undefined;

  const handleFieldChange = (field: StudioAssetPropertyField, rawValue: string): void => {
    if (!onChangeNodeConfig && !onChangeSelectedAssetNode) {
      return;
    }
    const value = coerceFieldValue(field, rawValue);
    const nextConfig = updateStudioAssetConfigByField({
      config: resolvedConfig,
      fieldPath: field.path,
      value,
    });
    onChangeNodeConfig?.(nextConfig);
    if (activeNode) {
      onChangeSelectedAssetNode?.(Object.freeze({
        ...activeNode,
        config: nextConfig,
      }));
    }
  };


  const handlePathNavigate = (nodeId: string): void => {
    if (!onChangeSelection) {
      return;
    }

    const nextSelection = navigateStudioAssetSelectionToPathNode({
      root: compositionRoot,
      selection,
      nodeId,
    });
    onChangeSelection(nextSelection);
  };

  const handleSelectFocusedNode = (): void => {
    if (!onChangeSelection || !compositionRoot || !boundSelection.focusedNode) {
      return;
    }
    onChangeSelection(createStudioAssetSelectionState({
      root: compositionRoot,
      nodeId: boundSelection.focusedNode.nodeId,
    }));
  };

  const renderField = (field: StudioAssetPropertyField): JSX.Element => {
    const fieldId = `asset-inspector-${activeNode?.nodeId ?? "none"}-${field.id}`;
    const currentValue = getValueByPath(resolvedConfig, field.path);
    const disabled = field.readOnly || (!onChangeNodeConfig && !onChangeSelectedAssetNode);
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

      {boundSelection.path.length > 1 ? (
        <div className="ui-row ui-row--wrap" style={{ gap: "0.25rem" }}>
          {boundSelection.path.map((entry, index) => {
            const isFocused = boundSelection.focusedNodeId === entry.nodeId;
            return (
              <button
                key={entry.nodeId}
                type="button"
                className={`ui-button ui-button--sm ${isFocused ? "" : "ui-button--ghost"}`}
                onClick={() => handlePathNavigate(entry.nodeId)}
                disabled={!onChangeSelection}
              >
                {registry.getById(entry.assetId)?.metadata.title ?? entry.assetId}
                {index < boundSelection.path.length - 1 ? " ›" : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {boundSelection.focusedNodeId && boundSelection.focusedNodeId !== boundSelection.selectedNodeId ? (
        <div className="ui-panel ui-stack ui-stack--2xs">
          <span className="ui-text-small ui-text-secondary">Viewing parent context.</span>
          <button
            type="button"
            className="ui-button ui-button--sm ui-button--ghost"
            onClick={handleSelectFocusedNode}
            disabled={!onChangeSelection}
          >
            Inspect this level
          </button>
        </div>
      ) : null}

      {boundSelection.stale ? (
        <p className="ui-text-small ui-text-muted">The selected asset is no longer available in this composition.</p>
      ) : null}

      {registration && activeNode ? (
        <div className="ui-stack ui-stack--2xs">
          <span className="ui-text-small"><strong>{registration.metadata.title}</strong></span>
          <span className="ui-text-small ui-text-secondary">{registration.kind} · {registration.metadata.assetType}</span>
          {registration.metadata.summary ? (
            <span className="ui-text-small ui-text-secondary">{registration.metadata.summary}</span>
          ) : null}
          {previewModel ? <StudioAssetPreviewCard preview={previewModel} compact /> : null}
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
