import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextPackageBrowser from "../ContextPackageBrowser";
import { ContextPackage } from "@application/context/models/ContextPackage";

describe("ContextPackageBrowser", () => {
  it("renders search controls, package cards, and the editor", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextPackageBrowser, {
        packages: [
          {
            id: "persona-bank",
            name: "Persona Bank",
            description: "Reusable personas",
            version: "v1",
            tags: ["persona", "support"],
            fragmentCount: 2,
            updatedAt: new Date("2026-03-19T00:00:00.000Z"),
          },
        ],
        selectedPackageId: "persona-bank",
        selectedPackage: new ContextPackage({
          id: "persona-bank",
          name: "Persona Bank",
          description: "Reusable personas",
          tags: ["persona", "support"],
          fragments: [{ id: "persona", kind: "persona", content: "Helpful", order: 0 }],
        }),
        searchQuery: "persona",
        searchTagsText: "support",
      }),
    );

    expect(html).toContain("Context library");
    expect(html).toContain("Search reusable context by name, tags, and description.");
    expect(html).toContain("Persona Bank");
    expect(html).toContain("Edit prompt pack");
  });
});

