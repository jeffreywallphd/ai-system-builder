import { useMemo } from "react";
import {
  ComfyImageManipulationPropertySchema,
  type ComfyImageManipulationConfig,
  type ComfyImageManipulationConfigValidationIssue,
} from "../../../../application/system-studio/ComfyImageManipulationPropertySchema";

type ComfySchemaGroup = (typeof ComfyImageManipulationPropertySchema.fields)[number];
type ComfySchemaField = ComfySchemaGroup["entries"][number];

const sectionLabels = Object.freeze({
  instructions: "Main editing instructions",
  imageSettings: "Image and result settings",
  faceReference: "Face reference controls (optional)",
  advanced: "Advanced controls (optional)",
  advancedModels: "Model choices",
  advancedGeneration: "Generation tuning",
  advancedIdentity: "Identity timing and model controls",
});

function getProgressiveDisclosure(field: ComfySchemaField): string | undefined {
  const metadata = field.metadata as Record<string, unknown> | undefined;
  return typeof metadata?.progressiveDisclosure === "string"
    ? metadata.progressiveDisclosure
    : undefined;
}

function isAdvancedField(groupId: ComfySchemaGroup["groupId"], field: ComfySchemaField): boolean {
  if (groupId === "models") {
    return true;
  }
  return getProgressiveDisclosure(field) === "advanced";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getValueAtPath(config: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => (
    isRecord(current) ? current[segment] : undefined
  ), config);
}

function setValueAtPath(
  config: Readonly<Record<string, unknown>>,
  path: string,
  value: unknown,
): Readonly<Record<string, unknown>> {
  const segments = path.split(".").filter((entry) => entry.length > 0);
  if (segments.length === 0) {
    return config;
  }

  const root: Record<string, unknown> = { ...config };
  let cursor: Record<string, unknown> = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) {
      continue;
    }
    if (index === segments.length - 1) {
      cursor[segment] = value;
      continue;
    }
    const existing = cursor[segment];
    const nextLevel = isRecord(existing) ? { ...existing } : {};
    cursor[segment] = nextLevel;
    cursor = nextLevel;
  }
  return root;
}

function collectFieldIssues(
  issues: ReadonlyArray<ComfyImageManipulationConfigValidationIssue>,
): ReadonlyMap<string, ReadonlyArray<string>> {
  const byPath = new Map<string, string[]>();
  for (const issue of issues) {
    if (!byPath.has(issue.path)) {
      byPath.set(issue.path, []);
    }
    byPath.get(issue.path)?.push(issue.message);
  }
  return byPath;
}

function toFriendlyEnumLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter((entry) => entry.length > 0)
    .map((entry) => `${entry.charAt(0).toUpperCase()}${entry.slice(1)}`)
    .join(" ");
}

function resolveNumberInputStep(field: ComfySchemaField): number {
  const validation = field.validation as Record<string, unknown>;
  if (field.type === "integer") {
    return Number.isFinite(validation.multipleOf) ? Number(validation.multipleOf) : 1;
  }
  return 0.01;
}

function resolveDefaultFaceBindingId(field: ComfySchemaField): string {
  const metadata = field.metadata as Record<string, unknown> | undefined;
  const supported = Array.isArray(metadata?.supportedDatasetBindingIds)
    ? metadata?.supportedDatasetBindingIds
    : undefined;
  if (supported && typeof supported[0] === "string" && supported[0].trim()) {
    return supported[0].trim();
  }
  return "faceid-reference";
}

function coerceDatasetAssetId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("asset:dataset:")) {
    return normalized;
  }
  return `asset:dataset:${normalized.replace(/^asset:/, "")}`;
}

export interface ComfyImageManipulationPropertyEditorProps {
  readonly value: ComfyImageManipulationConfig;
  readonly presetId: string;
  readonly onChange: (next: ComfyImageManipulationConfig) => void;
  readonly onPresetIdChange: (presetId: string) => void;
  readonly issues?: ReadonlyArray<ComfyImageManipulationConfigValidationIssue>;
  readonly disabled?: boolean;
}

export function ComfyImageManipulationPropertyEditor({
  value,
  presetId,
  onChange,
  onPresetIdChange,
  issues = Object.freeze([]),
  disabled = false,
}: ComfyImageManipulationPropertyEditorProps): JSX.Element {
  const promptsGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "prompts");
  const generationGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "generation");
  const outputGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "output");
  const faceIdGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "faceId");
  const modelsGroup = ComfyImageManipulationPropertySchema.fields.find((group) => group.groupId === "models");

  const fieldIssues = useMemo(() => collectFieldIssues(issues), [issues]);

  const instructionFields = promptsGroup?.entries ?? Object.freeze([]);
  const generationFields = generationGroup?.entries ?? Object.freeze([]);
  const imageResultFields = Object.freeze([
    ...generationFields.filter((entry) => !isAdvancedField("generation", entry)),
    ...(outputGroup?.entries ?? []),
  ]);
  const faceIdFields = faceIdGroup?.entries ?? Object.freeze([]);
  const faceReferenceFields = Object.freeze(faceIdFields.filter((entry) => !isAdvancedField("faceId", entry)));

  const advancedModelFields = Object.freeze((modelsGroup?.entries ?? []).filter((entry) => isAdvancedField("models", entry)));
  const advancedGenerationFields = Object.freeze(generationFields.filter((entry) => isAdvancedField("generation", entry)));
  const advancedIdentityFields = Object.freeze(faceIdFields.filter((entry) => isAdvancedField("faceId", entry)));
  const hasAdvancedFields = advancedModelFields.length > 0
    || advancedGenerationFields.length > 0
    || advancedIdentityFields.length > 0;

  const applyFieldValue = (field: ComfySchemaField, nextValue: unknown): void => {
    const candidate = setValueAtPath(value as unknown as Record<string, unknown>, field.path, nextValue);
    onChange(candidate as unknown as ComfyImageManipulationConfig);
  };

  const renderFieldIssues = (field: ComfySchemaField): JSX.Element | null => {
    const messages = fieldIssues.get(field.path);
    if (!messages || messages.length === 0) {
      return null;
    }
    return (
      <ul className="ui-text-small ui-text-danger ui-stack ui-stack--3xs">
        {messages.map((message) => (
          <li key={`${field.path}:${message}`}>{message}</li>
        ))}
      </ul>
    );
  };

  const renderField = (field: ComfySchemaField): JSX.Element => {
    const fieldValue = getValueAtPath(value as unknown as Record<string, unknown>, field.path);
    const validation = field.validation as Record<string, unknown>;
    const fieldId = `image-config-${field.path.replace(/\./g, "-")}`;

    if (field.type === "boolean") {
      return (
        <label key={field.path} className="ui-form-field">
          <span className="ui-form-field__label">{field.label}</span>
          <span className="ui-text-small ui-text-secondary">{field.description}</span>
          <label className="ui-row ui-row--xs ui-row--middle">
            <input
              id={fieldId}
              type="checkbox"
              checked={fieldValue === true}
              disabled={disabled}
              onChange={(event) => applyFieldValue(field, event.currentTarget.checked)}
            />
            <span className="ui-text-small">{fieldValue === true ? "On" : "Off"}</span>
          </label>
          {renderFieldIssues(field)}
        </label>
      );
    }

    if (field.type === "enum") {
      const options = Array.isArray(validation.options)
        ? validation.options.filter((option): option is string => typeof option === "string")
        : [];
      return (
        <label key={field.path} className="ui-form-field">
          <span className="ui-form-field__label">{field.label}</span>
          <span className="ui-text-small ui-text-secondary">{field.description}</span>
          <select
            id={fieldId}
            className="ui-input"
            value={typeof fieldValue === "string" ? fieldValue : String(field.defaultValue ?? "")}
            disabled={disabled}
            onChange={(event) => applyFieldValue(field, event.currentTarget.value)}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {toFriendlyEnumLabel(option)}
              </option>
            ))}
          </select>
          {renderFieldIssues(field)}
        </label>
      );
    }

    if (field.type === "dataset-reference-list") {
      const references = Array.isArray(fieldValue)
        ? fieldValue.filter((entry): entry is { readonly datasetAssetId?: string } => isRecord(entry))
        : [];
      const defaultBindingId = resolveDefaultFaceBindingId(field);
      const textValue = references
        .map((entry) => (typeof entry.datasetAssetId === "string" ? entry.datasetAssetId : ""))
        .filter((entry) => entry.length > 0)
        .join("\n");
      return (
        <label key={field.path} className="ui-form-field">
          <span className="ui-form-field__label">{field.label}</span>
          <span className="ui-text-small ui-text-secondary">{field.description}</span>
          <textarea
            id={fieldId}
            className="ui-input"
            rows={3}
            value={textValue}
            disabled={disabled}
            placeholder="One dataset reference per line"
            onChange={(event) => {
              const lines = event.currentTarget.value
                .split("\n")
                .map((entry) => coerceDatasetAssetId(entry))
                .filter((entry) => entry.length > 0);
              const next = lines.length > 0
                ? lines.map((datasetAssetId) => Object.freeze({
                  datasetBindingId: defaultBindingId,
                  datasetAssetId,
                }))
                : [];
              applyFieldValue(field, next);
            }}
          />
          <span className="ui-text-small ui-text-secondary">
            These references stay in system-managed image storage.
          </span>
          {renderFieldIssues(field)}
        </label>
      );
    }

    if (field.type === "string" && (field.id.toLowerCase().includes("prompt") || field.path.includes("prompts."))) {
      return (
        <label key={field.path} className="ui-form-field">
          <span className="ui-form-field__label">{field.label}</span>
          <span className="ui-text-small ui-text-secondary">{field.description}</span>
          <textarea
            id={fieldId}
            className="ui-input"
            rows={field.id === "positivePrompt" ? 4 : 2}
            value={typeof fieldValue === "string" ? fieldValue : String(field.defaultValue ?? "")}
            disabled={disabled}
            onChange={(event) => applyFieldValue(field, event.currentTarget.value)}
          />
          {renderFieldIssues(field)}
        </label>
      );
    }

    if (field.type === "number" || field.type === "integer") {
      const min = Number.isFinite(validation.min) ? Number(validation.min) : undefined;
      const max = Number.isFinite(validation.max) ? Number(validation.max) : undefined;
      return (
        <label key={field.path} className="ui-form-field">
          <span className="ui-form-field__label">{field.label}</span>
          <span className="ui-text-small ui-text-secondary">{field.description}</span>
          <input
            id={fieldId}
            className="ui-input"
            type="number"
            min={min}
            max={max}
            step={resolveNumberInputStep(field)}
            value={typeof fieldValue === "number" ? fieldValue : Number(field.defaultValue ?? 0)}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number(event.currentTarget.value);
              if (!Number.isFinite(parsed)) {
                return;
              }
              applyFieldValue(field, field.type === "integer" ? Math.round(parsed) : parsed);
            }}
          />
          {renderFieldIssues(field)}
        </label>
      );
    }

    return (
      <label key={field.path} className="ui-form-field">
        <span className="ui-form-field__label">{field.label}</span>
        <span className="ui-text-small ui-text-secondary">{field.description}</span>
        <input
          id={fieldId}
          className="ui-input"
          value={typeof fieldValue === "string" ? fieldValue : String(field.defaultValue ?? "")}
          disabled={disabled}
          onChange={(event) => applyFieldValue(field, event.currentTarget.value)}
        />
        {renderFieldIssues(field)}
      </label>
    );
  };

  return (
    <section className="ui-image-surface ui-stack ui-stack--sm">
      <header className="ui-image-surface__header">
        <h3 className="ui-image-surface__title">Edit settings</h3>
      </header>
      <label className="ui-form-field">
        <span className="ui-form-field__label">Preset</span>
        <span className="ui-text-small ui-text-secondary">Start from a ready-made style, then adjust details below.</span>
        <select
          className="ui-input"
          value={presetId}
          disabled={disabled}
          onChange={(event) => onPresetIdChange(event.currentTarget.value)}
        >
          {ComfyImageManipulationPropertySchema.presetProfiles.map((preset) => (
            <option key={preset.presetId} value={preset.presetId}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <section className="ui-stack ui-stack--xs">
        <h4 className="ui-text-small">{sectionLabels.instructions}</h4>
        {instructionFields.map((field) => renderField(field))}
      </section>
      <section className="ui-stack ui-stack--xs">
        <h4 className="ui-text-small">{sectionLabels.imageSettings}</h4>
        {imageResultFields.map((field) => renderField(field))}
      </section>
      <section className="ui-stack ui-stack--xs">
        <h4 className="ui-text-small">{sectionLabels.faceReference}</h4>
        {faceReferenceFields.map((field) => renderField(field))}
      </section>
      {hasAdvancedFields ? (
        <details className="ui-stack ui-stack--xs">
          <summary className="ui-text-small ui-text-secondary">{sectionLabels.advanced}</summary>
          {advancedModelFields.length > 0 ? (
            <section className="ui-stack ui-stack--2xs">
              <h4 className="ui-text-small">{sectionLabels.advancedModels}</h4>
              {advancedModelFields.map((field) => renderField(field))}
            </section>
          ) : null}
          {advancedGenerationFields.length > 0 ? (
            <section className="ui-stack ui-stack--2xs">
              <h4 className="ui-text-small">{sectionLabels.advancedGeneration}</h4>
              {advancedGenerationFields.map((field) => renderField(field))}
            </section>
          ) : null}
          {advancedIdentityFields.length > 0 ? (
            <section className="ui-stack ui-stack--2xs">
              <h4 className="ui-text-small">{sectionLabels.advancedIdentity}</h4>
              {advancedIdentityFields.map((field) => renderField(field))}
            </section>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}

export default ComfyImageManipulationPropertyEditor;
