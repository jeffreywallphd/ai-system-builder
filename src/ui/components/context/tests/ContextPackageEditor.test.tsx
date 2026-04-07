import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextPackageEditor from "../ContextPackageEditor";
import { ContextPackage } from "@application/context/models/ContextPackage";

describe("ContextPackageEditor", () => {
  it("renders package metadata fields and fragment authoring controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextPackageEditor, {
        contextPackage: new ContextPackage({
          id: "ctx-editor",
          name: "Editor Package",
          description: "Editable package",
          tags: ["shared"],
          references: [{ packageId: "base-persona" }],
          fragments: [{ id: "instructions", kind: "instructions", title: "Instructions", content: "Alpha", order: 0 }],
        }),
      }),
    );

    expect(html).toContain("Edit prompt pack");
    expect(html).toContain("Pack name");
    expect(html).toContain("Related packs");
    expect(html).toContain("Add section");
    expect(html).toContain("Save pack");
  });
});

