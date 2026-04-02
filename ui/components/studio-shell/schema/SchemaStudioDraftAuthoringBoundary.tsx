import { useMemo, useState } from "react";
import {
  addSchemaEntityToDocument,
  createEmptySchemaAssetDocument,
  deserializeSchemaAssetDocument,
  serializeSchemaAssetDocument,
  updateSchemaEntityInDocument,
  type SchemaAssetDocument,
  type SchemaEntityDefinition,
} from "../../../../domain/schema-studio/SchemaStudioDomain";
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
  readonly parseError?: string;
}

function parseSchemaDocument(content: string): ParsedSchemaDocument {
  if (!content.trim()) {
    return Object.freeze({ document: createEmptySchemaAssetDocument() });
  }

  try {
    return Object.freeze({ document: deserializeSchemaAssetDocument(content) });
  } catch (error) {
    return Object.freeze({
      document: createEmptySchemaAssetDocument(),
      parseError: error instanceof Error ? error.message : "Schema draft is malformed.",
    });
  }
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

export default function SchemaStudioDraftAuthoringBoundary({
  content,
  onChangeContent,
  onStudioEvent,
}: SchemaStudioDraftAuthoringBoundaryProps): JSX.Element {
  const parsed = useMemo(() => parseSchemaDocument(content), [content]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [entityError, setEntityError] = useState<string>();

  const selectedEntity = parsed.document.definition.entities.find((entity) => entity.entityId === selectedEntityId)
    ?? parsed.document.definition.entities[0];

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
      setEntityError(undefined);
      persistDocument(next);
    } catch (error) {
      setEntityError(error instanceof Error ? error.message : "Unable to add this table right now.");
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

  return (
    <div className="ui-stack ui-stack--sm" data-testid="schema-studio-canvas">
      <div className="ui-row ui-row--between ui-row--wrap">
        <div>
          <h3 className="ui-title">Schema canvas</h3>
          <p className="ui-text-muted">
            Organize tables and relationships for this data structure. Pipelines and execution flows stay in separate studios.
          </p>
        </div>
        <button type="button" className="ui-button ui-button--primary" onClick={createEntity}>
          Add table
        </button>
      </div>

      {parsed.parseError ? (
        <p className="ui-text-danger" data-testid="schema-studio-parse-error">
          Schema draft content is invalid. Fix the JSON to continue editing.
        </p>
      ) : null}

      {entityError ? (
        <p className="ui-text-danger" data-testid="schema-studio-entity-error">{entityError}</p>
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
                  rows={4}
                  value={selectedEntity.description ?? ""}
                  onChange={(event) => updateEntity({ description: event.target.value })}
                />
                <p className="ui-text-muted">Field and relationship editing is coming next. This first slice focuses on table structure.</p>
              </>
            ) : (
              <p className="ui-text-muted">Select a table to edit its details.</p>
            )}
          </div>
        </section>
      </div>

      <section className="ui-card ui-card--padded" data-testid="schema-studio-relationship-summary">
        <div className="ui-stack ui-stack--2xs">
          <strong>Relationships</strong>
          {parsed.document.definition.relationships.length === 0 ? (
            <p className="ui-text-muted">No relationships yet. Add table links in a future authoring step.</p>
          ) : (
            parsed.document.definition.relationships.map((relationship) => (
              <p key={relationship.relationshipId} className="ui-text-small">
                {relationship.label || relationship.relationshipId}: {relationship.sourceEntityId} → {relationship.targetEntityId}
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
