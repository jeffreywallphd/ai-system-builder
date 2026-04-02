import { z } from "zod";
import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../taxonomy/CompositionTaxonomy";

export const SchemaStudioIdentity = Object.freeze({
  studioType: "schema-studio",
  defaultStudioId: "studio-schemas",
  defaultStudioName: "Schema Studio",
});

export const SchemaAssetDocumentVersion = "1.0.0";

export const SchemaFieldTypeKinds = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  json: "json",
  uuid: "uuid",
  integer: "integer",
  decimal: "decimal",
  binary: "binary",
  reference: "reference",
  unknown: "unknown",
} as const);

export type SchemaFieldTypeKind = typeof SchemaFieldTypeKinds[keyof typeof SchemaFieldTypeKinds];

export const SchemaRelationshipCardinalityKinds = Object.freeze({
  oneToOne: "one-to-one",
  oneToMany: "one-to-many",
  manyToOne: "many-to-one",
  manyToMany: "many-to-many",
  unknown: "unknown",
} as const);

export type SchemaRelationshipCardinalityKind =
  typeof SchemaRelationshipCardinalityKinds[keyof typeof SchemaRelationshipCardinalityKinds];

const OptionalStringSchema = z.string().trim().min(1).optional();
const MetadataSchema = z.record(z.unknown()).optional();

const SchemaEntityCanvasLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  zIndex: z.number().int().optional(),
}).strict();

const SchemaFieldDefinitionSchema = z.object({
  fieldId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  key: OptionalStringSchema,
  type: z.string().trim().min(1),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  description: OptionalStringSchema,
  metadata: MetadataSchema,
}).strict();

const SchemaEntityFieldCollectionHookSchema = z.object({
  mode: z.enum(["inline", "reference"]),
  fieldIds: z.array(z.string().trim().min(1)).optional(),
  collectionAssetId: OptionalStringSchema,
  collectionVersionId: OptionalStringSchema,
  metadata: MetadataSchema,
}).strict();

const SchemaEntityDefinitionSchema = z.object({
  entityId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  label: OptionalStringSchema,
  description: OptionalStringSchema,
  fields: z.array(SchemaFieldDefinitionSchema).default([]),
  fieldCollection: SchemaEntityFieldCollectionHookSchema.optional(),
  metadata: MetadataSchema,
  layout: SchemaEntityCanvasLayoutSchema.optional(),
}).strict();

const SchemaRelationshipDefinitionSchema = z.object({
  relationshipId: z.string().trim().min(1),
  sourceEntityId: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1),
  sourceFieldId: OptionalStringSchema,
  targetFieldId: OptionalStringSchema,
  type: OptionalStringSchema,
  cardinality: z.enum([
    SchemaRelationshipCardinalityKinds.oneToOne,
    SchemaRelationshipCardinalityKinds.oneToMany,
    SchemaRelationshipCardinalityKinds.manyToOne,
    SchemaRelationshipCardinalityKinds.manyToMany,
    SchemaRelationshipCardinalityKinds.unknown,
  ]).optional(),
  label: OptionalStringSchema,
  description: OptionalStringSchema,
  metadata: MetadataSchema,
  /** Compatibility alias for older persisted payloads using `kind`. */
  kind: OptionalStringSchema,
}).strict();

const SchemaAssetDefinitionSchema = z.object({
  dialect: OptionalStringSchema,
  entities: z.array(SchemaEntityDefinitionSchema).default([]),
  relationships: z.array(SchemaRelationshipDefinitionSchema).default([]),
  metadata: MetadataSchema,
}).strict();

const SchemaAssetDocumentSchema = z.object({
  schemaVersion: z.string().trim().min(1).default(SchemaAssetDocumentVersion),
  definition: SchemaAssetDefinitionSchema,
}).strict();

export type SchemaEntityCanvasLayout = z.infer<typeof SchemaEntityCanvasLayoutSchema>;
export type SchemaFieldDefinition = z.infer<typeof SchemaFieldDefinitionSchema>;
export type SchemaEntityFieldCollectionHook = z.infer<typeof SchemaEntityFieldCollectionHookSchema>;
export type SchemaEntityDefinition = z.infer<typeof SchemaEntityDefinitionSchema>;
export type SchemaRelationshipDefinition = Omit<z.infer<typeof SchemaRelationshipDefinitionSchema>, "kind">;
export type SchemaAssetDefinition = z.infer<typeof SchemaAssetDefinitionSchema>;
export type SchemaAssetDocument = z.infer<typeof SchemaAssetDocumentSchema>;

export function createEmptySchemaAssetDocument(): SchemaAssetDocument {
  return Object.freeze({
    schemaVersion: SchemaAssetDocumentVersion,
    definition: Object.freeze({
      entities: Object.freeze([]),
      relationships: Object.freeze([]),
    }),
  });
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSchemaFieldDefinition(input: SchemaFieldDefinition): SchemaFieldDefinition {
  const parsed = SchemaFieldDefinitionSchema.parse(input);

  return Object.freeze({
    ...parsed,
    type: normalizeOptional(parsed.type) ?? SchemaFieldTypeKinds.unknown,
    key: normalizeOptional(parsed.key) ?? parsed.name,
    description: normalizeOptional(parsed.description),
  });
}

function normalizeSchemaRelationshipDefinition(input: z.infer<typeof SchemaRelationshipDefinitionSchema>): SchemaRelationshipDefinition {
  const parsed = SchemaRelationshipDefinitionSchema.parse(input);
  const normalizedType = normalizeOptional(parsed.type) ?? normalizeOptional(parsed.kind);

  return Object.freeze({
    relationshipId: parsed.relationshipId,
    sourceEntityId: parsed.sourceEntityId,
    targetEntityId: parsed.targetEntityId,
    sourceFieldId: normalizeOptional(parsed.sourceFieldId),
    targetFieldId: normalizeOptional(parsed.targetFieldId),
    type: normalizedType,
    cardinality: parsed.cardinality,
    label: normalizeOptional(parsed.label),
    description: normalizeOptional(parsed.description),
    metadata: parsed.metadata,
  });
}

export function createSchemaStudioTaxonomy() {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.schema,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
}

export function createSchemaAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["schema", ...(input.tags ?? [])]),
    taxonomy: createSchemaStudioTaxonomy(),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? SchemaStudioIdentity.studioType,
    },
  });
}

export function createSchemaEntityDefinition(input: SchemaEntityDefinition): SchemaEntityDefinition {
  const parsed = SchemaEntityDefinitionSchema.parse(input);

  const fields = parsed.fields.map((field) => normalizeSchemaFieldDefinition(field));
  const knownFieldIds = new Set(fields.map((field) => field.fieldId));

  const duplicateFieldIds = findDuplicateValues(fields.map((field) => field.fieldId));
  if (duplicateFieldIds.length > 0) {
    throw new Error(`Schema entity '${parsed.entityId}' contains duplicate field ids: ${duplicateFieldIds.join(", ")}.`);
  }

  const duplicateFieldNames = findDuplicateValues(fields.map((field) => field.name));
  if (duplicateFieldNames.length > 0) {
    throw new Error(`Schema entity '${parsed.entityId}' contains duplicate field names: ${duplicateFieldNames.join(", ")}.`);
  }

  const dedupedFieldIds = parsed.fieldCollection?.fieldIds
    ? [...new Set(parsed.fieldCollection.fieldIds.map((entry) => entry.trim()).filter(Boolean))]
    : undefined;

  if (parsed.fieldCollection?.mode === "inline") {
    const unresolvedFieldIds = (dedupedFieldIds ?? [])
      .filter((fieldId) => !knownFieldIds.has(fieldId));
    if (unresolvedFieldIds.length > 0) {
      throw new Error(
        `Schema entity '${parsed.entityId}' fieldCollection references unknown inline fields: ${unresolvedFieldIds.join(", ")}.`,
      );
    }
  }

  return Object.freeze({
    ...parsed,
    fields: Object.freeze(fields),
    fieldCollection: parsed.fieldCollection
      ? Object.freeze({
        ...parsed.fieldCollection,
        fieldIds: dedupedFieldIds
          ? Object.freeze(dedupedFieldIds)
          : parsed.fieldCollection.mode === "inline"
            ? Object.freeze(fields.map((field) => field.fieldId))
            : undefined,
      })
      : undefined,
  });
}

export function createSchemaAssetDocument(input: SchemaAssetDocument): SchemaAssetDocument {
  const parsed = SchemaAssetDocumentSchema.parse(input);

  const entities = parsed.definition.entities.map((entity) => createSchemaEntityDefinition(entity));
  const entityById = new Map(entities.map((entity) => [entity.entityId, entity]));

  const relationships = parsed.definition.relationships
    .map((relationship) => normalizeSchemaRelationshipDefinition(relationship));

  const duplicateEntityIds = findDuplicateValues(entities.map((entity) => entity.entityId));
  if (duplicateEntityIds.length > 0) {
    throw new Error(`Schema asset definition contains duplicate entity ids: ${duplicateEntityIds.join(", ")}.`);
  }

  const duplicateRelationshipIds = findDuplicateValues(relationships.map((relationship) => relationship.relationshipId));
  if (duplicateRelationshipIds.length > 0) {
    throw new Error(`Schema asset definition contains duplicate relationship ids: ${duplicateRelationshipIds.join(", ")}.`);
  }

  const invalidRelationshipIds = relationships
    .filter((relationship) => !entityById.has(relationship.sourceEntityId) || !entityById.has(relationship.targetEntityId))
    .map((relationship) => relationship.relationshipId);
  if (invalidRelationshipIds.length > 0) {
    throw new Error(`Schema relationships must reference declared entities. Invalid relationship ids: ${invalidRelationshipIds.join(", ")}.`);
  }

  for (const relationship of relationships) {
    const sourceEntity = entityById.get(relationship.sourceEntityId);
    const targetEntity = entityById.get(relationship.targetEntityId);

    if (!sourceEntity || !targetEntity) {
      continue;
    }

    if (relationship.sourceFieldId && !sourceEntity.fields.some((field) => field.fieldId === relationship.sourceFieldId)) {
      throw new Error(
        `Schema relationship '${relationship.relationshipId}' references unknown source field '${relationship.sourceFieldId}'.`,
      );
    }

    if (relationship.targetFieldId && !targetEntity.fields.some((field) => field.fieldId === relationship.targetFieldId)) {
      throw new Error(
        `Schema relationship '${relationship.relationshipId}' references unknown target field '${relationship.targetFieldId}'.`,
      );
    }
  }

  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    definition: Object.freeze({
      dialect: parsed.definition.dialect,
      entities: Object.freeze(entities),
      relationships: Object.freeze(relationships),
      metadata: parsed.definition.metadata,
    }),
  });
}

function slugifySchemaEntityName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "entity";
}

function nextSchemaEntityId(baseSlug: string, existingEntityIds: ReadonlySet<string>): string {
  let index = 1;
  let candidate = `entity:${baseSlug}`;
  while (existingEntityIds.has(candidate)) {
    index += 1;
    candidate = `entity:${baseSlug}-${index}`;
  }
  return candidate;
}

function hasDuplicateSchemaEntityName(
  entities: ReadonlyArray<SchemaEntityDefinition>,
  name: string,
  ignoreEntityId?: string,
): boolean {
  const normalizedTarget = name.trim().toLowerCase();
  return entities.some((entity) => {
    if (ignoreEntityId && entity.entityId === ignoreEntityId) {
      return false;
    }
    return entity.name.trim().toLowerCase() === normalizedTarget;
  });
}

export function addSchemaEntityToDocument(input: {
  readonly document: SchemaAssetDocument;
  readonly name: string;
  readonly description?: string;
  readonly label?: string;
  readonly metadata?: Record<string, unknown>;
  readonly layout?: SchemaEntityCanvasLayout;
}): SchemaAssetDocument {
  const normalizedDocument = createSchemaAssetDocument(input.document);
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Schema entity name is required.");
  }
  if (hasDuplicateSchemaEntityName(normalizedDocument.definition.entities, normalizedName)) {
    throw new Error(`Schema already contains an entity named '${normalizedName}'.`);
  }

  const entityId = nextSchemaEntityId(
    slugifySchemaEntityName(normalizedName),
    new Set(normalizedDocument.definition.entities.map((entity) => entity.entityId)),
  );

  const nextEntity = createSchemaEntityDefinition({
    entityId,
    name: normalizedName,
    label: normalizeOptional(input.label),
    description: normalizeOptional(input.description),
    fields: [],
    metadata: input.metadata,
    layout: input.layout,
  });

  return createSchemaAssetDocument({
    schemaVersion: normalizedDocument.schemaVersion,
    definition: {
      ...normalizedDocument.definition,
      entities: [...normalizedDocument.definition.entities, nextEntity],
    },
  });
}

export function updateSchemaEntityInDocument(input: {
  readonly document: SchemaAssetDocument;
  readonly entityId: string;
  readonly name: string;
  readonly description?: string;
  readonly label?: string;
  readonly metadata?: Record<string, unknown>;
  readonly layout?: SchemaEntityCanvasLayout;
}): SchemaAssetDocument {
  const normalizedDocument = createSchemaAssetDocument(input.document);
  const entityId = input.entityId.trim();
  if (!entityId) {
    throw new Error("Schema entity id is required.");
  }
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Schema entity name is required.");
  }
  if (hasDuplicateSchemaEntityName(normalizedDocument.definition.entities, normalizedName, entityId)) {
    throw new Error(`Schema already contains an entity named '${normalizedName}'.`);
  }

  const existing = normalizedDocument.definition.entities.find((entity) => entity.entityId === entityId);
  if (!existing) {
    throw new Error(`Schema entity '${entityId}' was not found.`);
  }

  const updated = createSchemaEntityDefinition({
    ...existing,
    name: normalizedName,
    label: normalizeOptional(input.label),
    description: normalizeOptional(input.description),
    metadata: input.metadata ?? existing.metadata,
    layout: input.layout ?? existing.layout,
  });

  return createSchemaAssetDocument({
    schemaVersion: normalizedDocument.schemaVersion,
    definition: {
      ...normalizedDocument.definition,
      entities: normalizedDocument.definition.entities.map((entity) => entity.entityId === entityId ? updated : entity),
    },
  });
}

function findDuplicateValues(values: ReadonlyArray<string>): ReadonlyArray<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return Object.freeze([...duplicates]);
}

export function serializeSchemaAssetDocument(document: SchemaAssetDocument): string {
  return JSON.stringify(createSchemaAssetDocument(document), null, 2);
}

export function deserializeSchemaAssetDocument(content: string): SchemaAssetDocument {
  const raw = JSON.parse(content) as unknown;
  return createSchemaAssetDocument(raw as SchemaAssetDocument);
}
