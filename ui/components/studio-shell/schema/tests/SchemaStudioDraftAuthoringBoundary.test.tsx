import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEmptySchemaAssetDocument,
  serializeSchemaAssetDocument,
} from "../../../../../domain/schema-studio/SchemaStudioDomain";
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
    expect(html).toContain("Relationships");
    expect(html).toContain("Pipelines and execution flows stay in separate studios");
  });

  it("renders tables and relationship placeholders from canonical schema content", () => {
    const content = serializeSchemaAssetDocument({
      schemaVersion: "1.0.0",
      definition: {
        entities: [{ entityId: "entity:customer", name: "Customer", fields: [] }],
        relationships: [{
          relationshipId: "relationship:customer-order",
          sourceEntityId: "entity:customer",
          targetEntityId: "entity:customer",
        }],
      },
    });

    const html = renderToStaticMarkup(
      <SchemaStudioDraftAuthoringBoundary
        content={content}
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain("Customer (0 fields)");
    expect(html).toContain("Table details");
    expect(html).toContain("relationship:customer-order");
  });

  it("shows a safe parse error for malformed schema content", () => {
    const html = renderToStaticMarkup(
      <SchemaStudioDraftAuthoringBoundary
        content="{bad-json"
        onChangeContent={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="schema-studio-parse-error"');
    expect(html).toContain("Schema draft content is invalid");
  });
});
