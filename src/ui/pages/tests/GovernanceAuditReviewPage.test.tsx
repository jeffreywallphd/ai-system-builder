import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import GovernanceAuditReviewPage from "../GovernanceAuditReviewPage";

describe("GovernanceAuditReviewPage", () => {
  it("renders session guidance when no authenticated session exists", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(GovernanceAuditReviewPage)),
    );

    expect(html).toContain("Governance review");
    expect(html).toContain("Sign in with an authenticated administrative session");
    expect(html).toContain("Go to sign in");
  });

  it("renders thin title for thin mode guidance", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(GovernanceAuditReviewPage, { thin: true })),
    );

    expect(html).toContain("Governance review (thin)");
  });
});
