import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEmptySchemaAssetDocument,
  serializeSchemaAssetDocument,
} from "@domain/schema-studio/SchemaStudioDomain";
import SchemaStudioDraftAuthoringBoundary from "../SchemaStudioDraftAuthoringBoundary";

describe("SchemaStudioDraftAuthoringBoundary", () => {
  it("renders an empty-state schema canvas for new drafts", () => {
    const html = renderToStaticMarkup(
      <SchemaStudioDraftAuthoringBoundary
        content={serializeSchemaAssetDocument(createEmptySchemaAssetDocument())}
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="schema-studio-canvas"');
    expect(html).toContain('data-testid="schema-studio-empty-state"');
    expect(html).toContain("Add table");
    expect(html).toContain("Fields");
    expect(html).toContain("Add relationship");
    expect(html).toContain("Pipelines and execution flows stay in separate studios");
  });

  it("renders tables, field inspector, and relationships from canonical schema content", () => {
    const content = serializeSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [{
          entityId: "entity:customer",
          name: "Customer",
          fields: [{ fieldId: "field:id", name: "id", type: "uuid", required: true }],
        }],
        relationships: [{
          relationshipId: "relationship:customer-order",
          sourceEntityId: "entity:customer",
          targetEntityId: "entity:customer",
          sourceFieldId: "field:id",
          targetFieldId: "field:id",
          cardinality: "one-to-many",
        }],
      },
    });

    const html = renderToStaticMarkup(
      <SchemaStudioDraftAuthoringBoundary
        content={content}
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain("Customer (1 fields)");
    expect(html).toContain('data-testid="schema-studio-field-inspector"');
    expect(html).toContain("relationship:customer-order");
    expect(html).toContain("Connection type");
  });

  it("shows a safe parse error for malformed schema content", () => {
    const html = renderToStaticMarkup(
      <SchemaStudioDraftAuthoringBoundary
        content="{bad-json"
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="schema-studio-parse-error"');
    expect(html).toContain("Some saved schema content was incomplete");
  });

  it("renders schema validation feedback for loaded issues", () => {
    const content = serializeSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [
          { entityId: "entity:a", name: "Customer", fields: [{ fieldId: "field:id", name: "id", type: "uuid" }] },
          { entityId: "entity:b", name: "Customer", fields: [{ fieldId: "field:id2", name: "id", type: "uuid" }] },
        ],
        relationships: [],
      },
    });
    const html = renderToStaticMarkup(
      <SchemaStudioDraftAuthoringBoundary
        content={content}
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="schema-studio-validation-summary"');
    expect(html).toContain("blocking issue(s) found");
  });
});

