import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";
import {
  addSchemaEntityToDocument,
  createEmptySchemaAssetDocument,
  createSchemaAssetDocument,
  createSchemaAssetMetadata,
  createSchemaEntityDefinition,
  createSchemaStudioTaxonomy,
  deserializeSchemaAssetDocument,
  SchemaFieldTypeKinds,
  SchemaRelationshipCardinalityKinds,
  serializeSchemaAssetDocument,
  SchemaStudioIdentity,
  updateSchemaEntityInDocument,
} from "../SchemaStudioDomain";

describe("SchemaStudioDomain", () => {
  it("creates schema taxonomy and metadata aligned to shared atomic asset conventions", () => {
    const taxonomy = createSchemaStudioTaxonomy();
    const contract = new CompositionAssetContractResolver().resolveContractForTaxonomy(taxonomy);
    const metadata = createSchemaAssetMetadata({
      title: "Customer Schema",
      summary: "Defines shared customer and order data structures.",
      contract,
    });

    expect(taxonomy).toEqual({ structuralKind: "atomic", semanticRole: "schema", behaviorKind: "none" });
    expect(metadata.taxonomy).toEqual(taxonomy);
    expect(metadata.tags).toContain("schema");
    expect(metadata.provenance?.sourceLabel).toBe(SchemaStudioIdentity.studioType);
    expect(metadata.contract?.parameters.some((parameter) => parameter.id === "schemaDialect")).toBeTrue();
  });

  it("normalizes schema entities with deduplicated field hooks", () => {
    const entity = createSchemaEntityDefinition({
      entityId: "entity:customer",
      name: "customer",
      label: "Customer",
      fields: [
        { fieldId: "field:id", name: "id", type: SchemaFieldTypeKinds.uuid, required: true },
        { fieldId: "field:email", name: "email", key: " email ", type: SchemaFieldTypeKinds.string },
      ],
      fieldCollection: {
        mode: "inline",
        fieldIds: ["field:id", "field:email", "field:id", " field:email "],
      },
    });

    expect(entity.fields[1]?.key).toBe("email");
    expect(entity.fieldCollection?.fieldIds).toEqual(["field:id", "field:email"]);
  });

  it("creates a serializable schema asset document with field and relationship validation", () => {
    const document = createSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        dialect: "relational",
        entities: [
          {
            entityId: "entity:customer",
            name: "customer",
            label: "Customer",
            fields: [
              { fieldId: "field:customer-id", name: "customer_id", type: SchemaFieldTypeKinds.uuid, required: true },
            ],
          },
          {
            entityId: "entity:order",
            name: "order",
            label: "Order",
            fields: [
              { fieldId: "field:order-id", name: "order_id", type: SchemaFieldTypeKinds.uuid, required: true },
              { fieldId: "field:customer-id", name: "customer_id", type: SchemaFieldTypeKinds.uuid, required: true },
            ],
          },
        ],
        relationships: [
          {
            relationshipId: "relationship:customer-order",
            sourceEntityId: "entity:customer",
            sourceFieldId: "field:customer-id",
            targetEntityId: "entity:order",
            targetFieldId: "field:customer-id",
            type: "foreign-key",
            cardinality: SchemaRelationshipCardinalityKinds.oneToMany,
          },
        ],
      },
    });

    const serialized = serializeSchemaAssetDocument(document);
    const rehydrated = deserializeSchemaAssetDocument(serialized);

    expect(rehydrated).toEqual(document);
  });

  it("accepts legacy relationship kind while normalizing to type", () => {
    const document = createSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [
          { entityId: "entity:a", name: "A" },
          { entityId: "entity:b", name: "B" },
        ],
        relationships: [{
          relationshipId: "relationship:a-b",
          sourceEntityId: "entity:a",
          targetEntityId: "entity:b",
          kind: "one-to-many",
        }],
      },
    });

    expect(document.definition.relationships[0]?.type).toBe("one-to-many");
  });

  it("rejects invalid relationship references", () => {
    expect(() => createSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [{ entityId: "entity:a", name: "A" }],
        relationships: [{
          relationshipId: "relationship:a-b",
          sourceEntityId: "entity:a",
          targetEntityId: "entity:missing",
        }],
      },
    })).toThrow("Schema relationships must reference declared entities");
  });

  it("rejects relationship field references when fields are missing", () => {
    expect(() => createSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [
          { entityId: "entity:a", name: "A", fields: [{ fieldId: "field:a", name: "a", type: "string" }] },
          { entityId: "entity:b", name: "B", fields: [{ fieldId: "field:b", name: "b", type: "string" }] },
        ],
        relationships: [{
          relationshipId: "relationship:a-b",
          sourceEntityId: "entity:a",
          targetEntityId: "entity:b",
          sourceFieldId: "field:missing",
          targetFieldId: "field:b",
        }],
      },
    })).toThrow("references unknown source field");
  });

  it("adds schema entities through canonical document helpers with stable identity and duplicate checks", () => {
    const withCustomer = addSchemaEntityToDocument({
      document: createEmptySchemaAssetDocument(),
      name: "Customer",
      description: "Stores customer records.",
      layout: { x: 120, y: 80 },
    });

    expect(withCustomer.definition.entities).toHaveLength(1);
    expect(withCustomer.definition.entities[0]?.entityId).toBe("entity:customer");
    expect(withCustomer.definition.entities[0]?.description).toBe("Stores customer records.");

    const withOrder = addSchemaEntityToDocument({
      document: withCustomer,
      name: "Order",
    });
    expect(withOrder.definition.entities[1]?.entityId).toBe("entity:order");

    expect(() => addSchemaEntityToDocument({
      document: withOrder,
      name: "Customer",
    })).toThrow("already contains an entity named");
  });

  it("updates schema entities through canonical helpers and rejects conflicting names", () => {
    const seed = createSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [
          { entityId: "entity:customer", name: "Customer" },
          { entityId: "entity:order", name: "Order" },
        ],
        relationships: [],
      },
    });

    const updated = updateSchemaEntityInDocument({
      document: seed,
      entityId: "entity:order",
      name: "Purchase",
      description: "Tracks purchase rows.",
      label: "Purchase",
    });

    expect(updated.definition.entities.find((entity) => entity.entityId === "entity:order")?.name).toBe("Purchase");
    expect(updated.definition.entities.find((entity) => entity.entityId === "entity:order")?.description).toBe("Tracks purchase rows.");

    expect(() => updateSchemaEntityInDocument({
      document: updated,
      entityId: "entity:order",
      name: "Customer",
    })).toThrow("already contains an entity named");
  });
});
