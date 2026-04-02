import { describe, expect, it } from "bun:test";
import { CompositionAssetContractResolver } from "../../../application/contracts/CompositionAssetContractResolver";
import {
  createSchemaAssetDocument,
  createSchemaAssetMetadata,
  createSchemaEntityDefinition,
  createSchemaStudioTaxonomy,
  deserializeSchemaAssetDocument,
  serializeSchemaAssetDocument,
  SchemaStudioIdentity,
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
      fieldCollection: {
        mode: "inline",
        fieldIds: ["id", "email", "id", " email "],
      },
    });

    expect(entity.fieldCollection?.fieldIds).toEqual(["id", "email"]);
  });

  it("creates a serializable schema asset document with relationship validation", () => {
    const document = createSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        dialect: "relational",
        entities: [
          { entityId: "entity:customer", name: "customer", label: "Customer" },
          { entityId: "entity:order", name: "order", label: "Order" },
        ],
        relationships: [
          {
            relationshipId: "relationship:customer-order",
            sourceEntityId: "entity:customer",
            targetEntityId: "entity:order",
            kind: "one-to-many",
          },
        ],
      },
    });

    const serialized = serializeSchemaAssetDocument(document);
    const rehydrated = deserializeSchemaAssetDocument(serialized);

    expect(rehydrated).toEqual(document);
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
});
