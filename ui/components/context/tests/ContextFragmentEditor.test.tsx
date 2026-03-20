import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextFragmentEditor from "../ContextFragmentEditor";

describe("ContextFragmentEditor", () => {
  it("renders author controls for kind, content, order, and metadata tags", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextFragmentEditor, {
        fragment: {
          id: "persona",
          kind: "persona",
          title: "Persona",
          content: "Helpful and precise",
          order: 2,
          metadata: { tags: ["team", "support"] },
        },
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("Fragment ID");
    expect(html).toContain("Metadata tags");
    expect(html).toContain("Helpful and precise");
    expect(html).toContain("formatting-constraints");
  });
});
