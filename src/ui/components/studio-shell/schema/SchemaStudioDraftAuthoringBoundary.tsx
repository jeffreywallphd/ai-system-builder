import { useMemo, useState } from "react";
import {
  addSchemaEntityToDocument,
  addSchemaFieldToEntityInDocument,
  addSchemaRelationshipToDocument,
  createEmptySchemaAssetDocument,
  deserializeSchemaAssetDocumentForEditing,
  SchemaValidationIssueCodes,
  SchemaValidationSeverityKinds,
  SchemaFieldTypeKinds,
  SchemaRelationshipCardinalityKinds,
  serializeSchemaAssetDocument,
  validateSchemaAssetDocument,
  updateSchemaEntityInDocument,
  updateSchemaFieldInEntityInDocument,
  removeSchemaFieldFromEntityInDocument,
  type SchemaAssetDocument,
  type SchemaEntityDefinition,
  type SchemaFieldTypeKind,
  type SchemaRelationshipCardinalityKind,
} from "@domain/schema-studio/SchemaStudioDomain";
import {
  StudioEmbeddedIntentKinds,
  createStudioIntentEvent,
  type StudioEmbeddedEvent,
} from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";

interface SchemaStudioDraftAuthoringBoundaryProps {
  readonly content: string;
  readonly onChangeContent: (nextContent: string) => void;
  readonly onStudioEvent?: (event: StudioEmbeddedEvent) => void;
}

interface ParsedSchemaDocument {
  readonly document: SchemaAssetDocument;
  readonly hasMalformedContent: boolean;
}

const schemaFieldTypeOptions = Object.freeze(Object.values(SchemaFieldTypeKinds));
const schemaRelationshipCardinalityOptions = Object.freeze(Object.values(SchemaRelationshipCardinalityKinds));

function parseSchemaDocument(content: string): ParsedSchemaDocument {
  if (!content.trim()) {
    return Object.freeze({ document: createEmptySchemaAssetDocument(), hasMalformedContent: false });
  }

  const parsed = deserializeSchemaAssetDocumentForEditing(content);
  return Object.freeze({
    document: parsed.document,
    hasMalformedContent: parsed.issues.some((issue) => issue.code === SchemaValidationIssueCodes.schemaMalformed),
  });
}

function createDefaultEntityName(entities: ReadonlyArray<SchemaEntityDefinition>): string {
  const existingNames = new Set(entities.map((entity) => entity.name.trim().toLowerCase()));
  let index = 1;
  while (true) {
    const candidate = index === 1 ? "New table" : `New table ${index}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    index += 1;
  }
}

function createDefaultEntityLayout(entities: ReadonlyArray<SchemaEntityDefinition>): { readonly x: number; readonly y: number } {
  const index = entities.length;
  return Object.freeze({
    x: 80 + ((index % 4) * 240),
    y: 80 + (Math.floor(index / 4) * 180),
  });
}

function createDefaultFieldName(entity: SchemaEntityDefinition): string {
  const existingNames = new Set(entity.fields.map((field) => field.name.trim().toLowerCase()));
  let index = 1;
  while (true) {
    const candidate = index === 1 ? "new_field" : `new_field_${index}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    index += 1;
  }
}

export default function SchemaStudioDraftAuthoringBoundary({
  content,
  onChangeContent,
  onStudioEvent,
}: SchemaStudioDraftAuthoringBoundaryProps): JSX.Element {
  const parsed = useMemo(() => parseSchemaDocument(content), [content]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [selectedFieldId, setSelectedFieldId] = useState<string>();
  const [entityError, setEntityError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [relationshipError, setRelationshipError] = useState<string>();
  const [relationshipDraft, setRelationshipDraft] = useState<{
    readonly sourceEntityId?: string;
    readonly sourceFieldId?: string;
    readonly targetEntityId?: string;
    readonly targetFieldId?: string;
    readonly cardinality?: SchemaRelationshipCardinalityKind;
    readonly type?: string;
    readonly label?: string;
    readonly description?: string;
  }>({
    sourceEntityId: undefined,
    sourceFieldId: undefined,
    targetEntityId: undefined,
    targetFieldId: undefined,
    cardinality: SchemaRelationshipCardinalityKinds.oneToMany,
    type: "foreign-key",
    label: "",
    description: "",
  });

  const selectedEntity = parsed.document.definition.entities.find((entity) => entity.entityId === selectedEntityId)
    ?? parsed.document.definition.entities[0];
  const selectedField = selectedEntity?.fields.find((field) => field.fieldId === selectedFieldId)
    ?? selectedEntity?.fields[0];
  const validation = useMemo(() => validateSchemaAssetDocument(parsed.document), [parsed.document]);
  const blockingIssues = validation.issues.filter((issue) => issue.severity === SchemaValidationSeverityKinds.error);
  const advisoryIssues = validation.issues.filter((issue) => issue.severity !== SchemaValidationSeverityKinds.error);

  const persistDocument = (nextDocument: SchemaAssetDocument): void => {
    onChangeContent(serializeSchemaAssetDocument(nextDocument));
    onStudioEvent?.(createStudioIntentEvent({
      kind: StudioEmbeddedIntentKinds.applyRequest,
      payload: Object.freeze({ scope: "changes" }),
    }));
  };

  const createEntity = (): void => {
    try {
      const next = addSchemaEntityToDocument({
        document: parsed.document,
        name: createDefaultEntityName(parsed.document.definition.entities),
        layout: createDefaultEntityLayout(parsed.document.definition.entities),
      });
      const createdEntity = next.definition.entities[next.definition.entities.length - 1];
      setSelectedEntityId(createdEntity?.entityId);
      setSelectedFieldId(undefined);
      setEntityError(undefined);
      persistDocument(next);
    } catch (error) {
      setEntityError(error instanceof Error ? error.message : "Unable to add this table right now.");
    }
  };

  const createField = (): void => {
    if (!selectedEntity) {
      setFieldError("Select a table before adding fields.");
      return;
    }

    try {
      const next = addSchemaFieldToEntityInDocument({
        document: parsed.document,
        entityId: selectedEntity.entityId,
        name: createDefaultFieldName(selectedEntity),
        type: SchemaFieldTypeKinds.string,
      });
      const updatedEntity = next.definition.entities.find((entity) => entity.entityId === selectedEntity.entityId);
      const createdField = updatedEntity?.fields[updatedEntity.fields.length - 1];
      setSelectedFieldId(createdField?.fieldId);
      setFieldError(undefined);
      persistDocument(next);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "Unable to add this field right now.");
    }
  };

  const deleteField = (fieldId: string): void => {
    if (!selectedEntity) {
      return;
    }
    try {
      const next = removeSchemaFieldFromEntityInDocument({
        document: parsed.document,
        entityId: selectedEntity.entityId,
        fieldId,
      });
      setFieldError(undefined);
      setSelectedFieldId(undefined);
      persistDocument(next);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "Unable to remove this field.");
    }
  };

  const updateEntity = (updates: {
    readonly name?: string;
    readonly description?: string;
    readonly label?: string;
  }): void => {
    if (!selectedEntity) {
      return;
    }

    try {
      const next = updateSchemaEntityInDocument({
        document: parsed.document,
        entityId: selectedEntity.entityId,
        name: updates.name ?? selectedEntity.name,
        description: updates.description ?? selectedEntity.description,
        label: updates.label ?? selectedEntity.label,
      });
      setEntityError(undefined);
      persistDocument(next);
    } catch (error) {
      setEntityError(error instanceof Error ? error.message : "Unable to save table updates.");
    }
  };

  const updateField = (updates: {
    readonly name?: string;
    readonly key?: string;
    readonly type?: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
    readonly description?: string;
  }): void => {
    if (!selectedEntity || !selectedField) {
      return;
    }

    try {
      const next = updateSchemaFieldInEntityInDocument({
        document: parsed.document,
        entityId: selectedEntity.entityId,
        fieldId: selectedField.fieldId,
        name: updates.name ?? selectedField.name,
        key: updates.key ?? selectedField.key,
        type: updates.type ?? selectedField.type,
        required: updates.required ?? selectedField.required,
        defaultValue: updates.defaultValue ?? selectedField.defaultValue,
        description: updates.description ?? selectedField.description,
      });
      setFieldError(undefined);
      persistDocument(next);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "Unable to save field updates.");
    }
  };

  const createRelationship = (): void => {
    try {
      if (!relationshipDraft.sourceEntityId || !relationshipDraft.targetEntityId) {
        throw new Error("Choose a source and target table to create a relationship.");
      }

      const next = addSchemaRelationshipToDocument({
        document: parsed.document,
        sourceEntityId: relationshipDraft.sourceEntityId,
        sourceFieldId: relationshipDraft.sourceFieldId,
        targetEntityId: relationshipDraft.targetEntityId,
        targetFieldId: relationshipDraft.targetFieldId,
        cardinality: relationshipDraft.cardinality,
        type: relationshipDraft.type,
        label: relationshipDraft.label,
        description: relationshipDraft.description,
      });
      setRelationshipError(undefined);
      persistDocument(next);
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : "Unable to create this relationship.");
    }
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="schema-studio-canvas">
      <div className="ui-row ui-row--between ui-row--wrap">
        <div>
          <h3 className="ui-title">Schema canvas</h3>
          <p className="ui-text-muted">
            Organize tables and links for this data structure. Pipelines and execution flows stay in separate studios.
          </p>
        </div>
        <button type="button" className="ui-button ui-button--primary" onClick={createEntity}>
          Add table
        </button>
      </div>

      {parsed.hasMalformedContent ? (
        <p className="ui-text-danger" data-testid="schema-studio-parse-error">
          Some saved schema content was incomplete. The editor loaded what it could and flagged issues below.
        </p>
      ) : null}

      {entityError ? (
        <p className="ui-text-danger" data-testid="schema-studio-entity-error">{entityError}</p>
      ) : null}

      {fieldError ? (
        <p className="ui-text-danger" data-testid="schema-studio-field-error">{fieldError}</p>
      ) : null}

      {relationshipError ? (
        <p className="ui-text-danger" data-testid="schema-studio-relationship-error">{relationshipError}</p>
      ) : null}

      {validation.issues.length > 0 ? (
        <section className="ui-card ui-card--padded" data-testid="schema-studio-validation-summary">
          <div className="ui-stack ui-stack--3xs">
            <strong>Schema check results</strong>
            {blockingIssues.length > 0 ? (
              <p className="ui-text-danger">
                {blockingIssues.length} blocking issue(s) found.
              </p>
            ) : (
              <p className="ui-text-muted">No blocking issues found.</p>
            )}
            {blockingIssues.map((issue) => (
              <p key={`${issue.code}:${issue.path ?? issue.message}`} className="ui-text-danger">{issue.message}</p>
            ))}
            {advisoryIssues.map((issue) => (
              <p key={`${issue.code}:${issue.path ?? issue.message}`} className="ui-text-small ui-text-muted">
                {issue.message}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="ui-grid ui-grid--2col">
        <section className="ui-card ui-card--padded" data-testid="schema-studio-canvas-entities">
          <div className="ui-stack ui-stack--2xs">
            <strong>Tables</strong>
            {parsed.document.definition.entities.length === 0 ? (
              <p className="ui-text-muted" data-testid="schema-studio-empty-state">
                No tables yet. Add your first table to start designing this schema.
              </p>
            ) : (
              parsed.document.definition.entities.map((entity) => (
                <button
                  key={entity.entityId}
                  type="button"
                  className={`ui-button ui-button--sm ${entity.entityId === selectedEntity?.entityId ? "ui-button--primary" : "ui-button--ghost"}`}
                  onClick={() => {
                    setSelectedEntityId(entity.entityId);
                    setSelectedFieldId(undefined);
                    setRelationshipDraft((previous) => ({
                      ...previous,
                      sourceEntityId: previous.sourceEntityId ?? entity.entityId,
                      targetEntityId: previous.targetEntityId ?? entity.entityId,
                    }));
                    onStudioEvent?.(createStudioIntentEvent({
                      kind: StudioEmbeddedIntentKinds.selectionChange,
                      payload: Object.freeze({
                        targetType: "item",
                        targetId: entity.entityId,
                      }),
                    }));
                  }}
                >
                  {entity.label || entity.name} ({entity.fields.length} fields)
                </button>
              ))
            )}
          </div>
        </section>

        <section className="ui-card ui-card--padded" data-testid="schema-studio-entity-editor">
          <div className="ui-stack ui-stack--2xs">
            <strong>Table details</strong>
            {selectedEntity ? (
              <>
                <label className="ui-label" htmlFor="schema-entity-name">Name</label>
                <input
                  id="schema-entity-name"
                  className="ui-input"
                  value={selectedEntity.name}
                  onChange={(event) => updateEntity({ name: event.target.value })}
                />
                <label className="ui-label" htmlFor="schema-entity-label">Display name</label>
                <input
                  id="schema-entity-label"
                  className="ui-input"
                  value={selectedEntity.label ?? ""}
                  onChange={(event) => updateEntity({ label: event.target.value })}
                />
                <label className="ui-label" htmlFor="schema-entity-description">Description</label>
                <textarea
                  id="schema-entity-description"
                  className="ui-textarea"
                  rows={3}
                  value={selectedEntity.description ?? ""}
                  onChange={(event) => updateEntity({ description: event.target.value })}
                />
              </>
            ) : (
              <p className="ui-text-muted">Select a table to edit its details.</p>
            )}
          </div>
        </section>
      </div>

      <section className="ui-card ui-card--padded" data-testid="schema-studio-field-inspector">
        <div className="ui-stack ui-stack--2xs">
          <div className="ui-row ui-row--between ui-row--wrap">
            <strong>Fields</strong>
            <button type="button" className="ui-button ui-button--sm ui-button--ghost" onClick={createField}>
              Add field
            </button>
          </div>

          {!selectedEntity ? (
            <p className="ui-text-muted">Select a table to inspect and edit its fields.</p>
          ) : selectedEntity.fields.length === 0 ? (
            <p className="ui-text-muted">No fields yet. Add a field to describe what this table stores.</p>
          ) : (
            <div className="ui-grid ui-grid--2col">
              <div className="ui-stack ui-stack--3xs">
                {selectedEntity.fields.map((field) => (
                  <div key={field.fieldId} className="ui-row ui-row--between ui-row--wrap">
                    <button
                      type="button"
                      className={`ui-button ui-button--sm ${selectedField?.fieldId === field.fieldId ? "ui-button--primary" : "ui-button--ghost"}`}
                      onClick={() => setSelectedFieldId(field.fieldId)}
                    >
                      {field.name} ({field.type})
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--sm ui-button--ghost"
                      onClick={() => deleteField(field.fieldId)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="ui-stack ui-stack--3xs">
                {selectedField ? (
                  <>
                    <label className="ui-label" htmlFor="schema-field-name">Name</label>
                    <input
                      id="schema-field-name"
                      className="ui-input"
                      value={selectedField.name}
                      onChange={(event) => updateField({ name: event.target.value })}
                    />
                    <label className="ui-label" htmlFor="schema-field-key">Key</label>
                    <input
                      id="schema-field-key"
                      className="ui-input"
                      value={selectedField.key ?? ""}
                      onChange={(event) => updateField({ key: event.target.value })}
                    />
                    <label className="ui-label" htmlFor="schema-field-type">Type</label>
                    <select
                      id="schema-field-type"
                      className="ui-input"
                      value={selectedField.type}
                      onChange={(event) => updateField({ type: event.target.value as SchemaFieldTypeKind })}
                    >
                      {schemaFieldTypeOptions.map((fieldType) => (
                        <option key={fieldType} value={fieldType}>{fieldType}</option>
                      ))}
                    </select>
                    <label className="ui-row ui-row--start ui-row--gap-xs" htmlFor="schema-field-required">
                      <input
                        id="schema-field-required"
                        type="checkbox"
                        checked={selectedField.required}
                        onChange={(event) => updateField({ required: event.target.checked })}
                      />
                      Required field
                    </label>
                    <label className="ui-label" htmlFor="schema-field-default-value">Default value (optional)</label>
                    <input
                      id="schema-field-default-value"
                      className="ui-input"
                      value={selectedField.defaultValue == null ? "" : String(selectedField.defaultValue)}
                      onChange={(event) => updateField({ defaultValue: event.target.value })}
                    />
                    <label className="ui-label" htmlFor="schema-field-description">Description</label>
                    <textarea
                      id="schema-field-description"
                      className="ui-textarea"
                      rows={3}
                      value={selectedField.description ?? ""}
                      onChange={(event) => updateField({ description: event.target.value })}
                    />
                  </>
                ) : (
                  <p className="ui-text-muted">Select a field to edit its settings.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="ui-card ui-card--padded" data-testid="schema-studio-relationship-summary">
        <div className="ui-stack ui-stack--2xs">
          <strong>Relationships</strong>
          <p className="ui-text-muted">Link tables so people can understand how records connect.</p>
          <div className="ui-grid ui-grid--2col">
            <div className="ui-stack ui-stack--3xs">
              <label className="ui-label" htmlFor="schema-relationship-source-table">From table</label>
              <select
                id="schema-relationship-source-table"
                className="ui-input"
                value={relationshipDraft.sourceEntityId ?? ""}
                onChange={(event) => {
                  const sourceEntityId = event.target.value || undefined;
                  setRelationshipDraft((previous) => ({
                    ...previous,
                    sourceEntityId,
                    sourceFieldId: undefined,
                  }));
                }}
              >
                <option value="">Select table</option>
                {parsed.document.definition.entities.map((entity) => (
                  <option key={entity.entityId} value={entity.entityId}>{entity.label ?? entity.name}</option>
                ))}
              </select>

              <label className="ui-label" htmlFor="schema-relationship-source-field">From field (optional)</label>
              <select
                id="schema-relationship-source-field"
                className="ui-input"
                value={relationshipDraft.sourceFieldId ?? ""}
                onChange={(event) => setRelationshipDraft((previous) => ({
                  ...previous,
                  sourceFieldId: event.target.value || undefined,
                }))}
              >
                <option value="">None</option>
                {parsed.document.definition.entities
                  .find((entity) => entity.entityId === relationshipDraft.sourceEntityId)
                  ?.fields
                  .map((field) => (
                    <option key={field.fieldId} value={field.fieldId}>{field.name}</option>
                  ))}
              </select>

              <label className="ui-label" htmlFor="schema-relationship-cardinality">Connection type</label>
              <select
                id="schema-relationship-cardinality"
                className="ui-input"
                value={relationshipDraft.cardinality ?? ""}
                onChange={(event) => setRelationshipDraft((previous) => ({
                  ...previous,
                  cardinality: event.target.value as SchemaRelationshipCardinalityKind,
                }))}
              >
                {schemaRelationshipCardinalityOptions.map((cardinality) => (
                  <option key={cardinality} value={cardinality}>{cardinality}</option>
                ))}
              </select>
            </div>

            <div className="ui-stack ui-stack--3xs">
              <label className="ui-label" htmlFor="schema-relationship-target-table">To table</label>
              <select
                id="schema-relationship-target-table"
                className="ui-input"
                value={relationshipDraft.targetEntityId ?? ""}
                onChange={(event) => {
                  const targetEntityId = event.target.value || undefined;
                  setRelationshipDraft((previous) => ({
                    ...previous,
                    targetEntityId,
                    targetFieldId: undefined,
                  }));
                }}
              >
                <option value="">Select table</option>
                {parsed.document.definition.entities.map((entity) => (
                  <option key={entity.entityId} value={entity.entityId}>{entity.label ?? entity.name}</option>
                ))}
              </select>

              <label className="ui-label" htmlFor="schema-relationship-target-field">To field (optional)</label>
              <select
                id="schema-relationship-target-field"
                className="ui-input"
                value={relationshipDraft.targetFieldId ?? ""}
                onChange={(event) => setRelationshipDraft((previous) => ({
                  ...previous,
                  targetFieldId: event.target.value || undefined,
                }))}
              >
                <option value="">None</option>
                {parsed.document.definition.entities
                  .find((entity) => entity.entityId === relationshipDraft.targetEntityId)
                  ?.fields
                  .map((field) => (
                    <option key={field.fieldId} value={field.fieldId}>{field.name}</option>
                  ))}
              </select>

              <label className="ui-label" htmlFor="schema-relationship-label">Label (optional)</label>
              <input
                id="schema-relationship-label"
                className="ui-input"
                value={relationshipDraft.label ?? ""}
                onChange={(event) => setRelationshipDraft((previous) => ({
                  ...previous,
                  label: event.target.value,
                }))}
              />

              <label className="ui-label" htmlFor="schema-relationship-description">Description (optional)</label>
              <textarea
                id="schema-relationship-description"
                className="ui-textarea"
                rows={2}
                value={relationshipDraft.description ?? ""}
                onChange={(event) => setRelationshipDraft((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))}
              />
            </div>
          </div>

          <details>
            <summary className="ui-text-small">Advanced details</summary>
            <div className="ui-stack ui-stack--3xs">
              <label className="ui-label" htmlFor="schema-relationship-type">Technical relationship type (optional)</label>
              <input
                id="schema-relationship-type"
                className="ui-input"
                value={relationshipDraft.type ?? ""}
                onChange={(event) => setRelationshipDraft((previous) => ({
                  ...previous,
                  type: event.target.value,
                }))}
              />
            </div>
          </details>

          <div>
            <button type="button" className="ui-button ui-button--primary" onClick={createRelationship}>
              Add relationship
            </button>
          </div>

          {parsed.document.definition.relationships.length === 0 ? (
            <p className="ui-text-muted">No relationships yet. Add links between tables to map your structure.</p>
          ) : (
            parsed.document.definition.relationships.map((relationship) => (
              <p key={relationship.relationshipId} className="ui-text-small">
                {relationship.label || relationship.relationshipId}: {relationship.sourceEntityId}
                {relationship.sourceFieldId ? `.${relationship.sourceFieldId}` : ""}
                {" "}â†’{" "}
                {relationship.targetEntityId}
                {relationship.targetFieldId ? `.${relationship.targetFieldId}` : ""}
                {relationship.cardinality ? ` (${relationship.cardinality})` : ""}
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

