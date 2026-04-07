import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextPackageCard from "../ContextPackageCard";

describe("ContextPackageCard", () => {
  it("renders key package metadata for library browsing", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextPackageCard, {
        contextPackage: {
          id: "ctx-card",
          name: "Card Package",
          description: "Reusable authoring help",
          version: "v2",
          tags: ["shared", "authoring"],
          fragmentCount: 3,
          updatedAt: new Date("2026-03-19T00:00:00.000Z"),
        },
        isSelected: true,
      }),
    );

    expect(html).toContain("Card Package");
    expect(html).toContain("3 sections");
    expect(html).toContain("#shared");
  });
});
