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

const OptionalStringSchema = z.string().trim().min(1).optional();
const MetadataSchema = z.record(z.unknown()).optional();

const SchemaEntityCanvasLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  zIndex: z.number().int().optional(),
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
  fieldCollection: SchemaEntityFieldCollectionHookSchema.optional(),
  metadata: MetadataSchema,
  layout: SchemaEntityCanvasLayoutSchema.optional(),
}).strict();

const SchemaRelationshipDefinitionSchema = z.object({
  relationshipId: z.string().trim().min(1),
  sourceEntityId: z.string().trim().min(1),
  targetEntityId: z.string().trim().min(1),
  kind: OptionalStringSchema,
  label: OptionalStringSchema,
  metadata: MetadataSchema,
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
export type SchemaEntityFieldCollectionHook = z.infer<typeof SchemaEntityFieldCollectionHookSchema>;
export type SchemaEntityDefinition = z.infer<typeof SchemaEntityDefinitionSchema>;
export type SchemaRelationshipDefinition = z.infer<typeof SchemaRelationshipDefinitionSchema>;
export type SchemaAssetDefinition = z.infer<typeof SchemaAssetDefinitionSchema>;
export type SchemaAssetDocument = z.infer<typeof SchemaAssetDocumentSchema>;

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
  const dedupedFieldIds = parsed.fieldCollection?.fieldIds
    ? [...new Set(parsed.fieldCollection.fieldIds.map((entry) => entry.trim()).filter(Boolean))]
    : undefined;

  return Object.freeze({
    ...parsed,
    fieldCollection: parsed.fieldCollection
      ? Object.freeze({
        ...parsed.fieldCollection,
        fieldIds: dedupedFieldIds ? Object.freeze(dedupedFieldIds) : undefined,
      })
      : undefined,
  });
}

export function createSchemaAssetDocument(input: SchemaAssetDocument): SchemaAssetDocument {
  const parsed = SchemaAssetDocumentSchema.parse(input);

  const entities = parsed.definition.entities.map((entity) => createSchemaEntityDefinition(entity));
  const knownEntityIds = new Set(entities.map((entity) => entity.entityId));

  const relationships = parsed.definition.relationships.map((relationship) => Object.freeze({
    ...relationship,
  }));

  const duplicateEntityIds = findDuplicateValues(entities.map((entity) => entity.entityId));
  if (duplicateEntityIds.length > 0) {
    throw new Error(`Schema asset definition contains duplicate entity ids: ${duplicateEntityIds.join(", ")}.`);
  }

  const duplicateRelationshipIds = findDuplicateValues(relationships.map((relationship) => relationship.relationshipId));
  if (duplicateRelationshipIds.length > 0) {
    throw new Error(`Schema asset definition contains duplicate relationship ids: ${duplicateRelationshipIds.join(", ")}.`);
  }

  const invalidRelationshipIds = relationships
    .filter((relationship) => !knownEntityIds.has(relationship.sourceEntityId) || !knownEntityIds.has(relationship.targetEntityId))
    .map((relationship) => relationship.relationshipId);
  if (invalidRelationshipIds.length > 0) {
    throw new Error(`Schema relationships must reference declared entities. Invalid relationship ids: ${invalidRelationshipIds.join(", ")}.`);
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
