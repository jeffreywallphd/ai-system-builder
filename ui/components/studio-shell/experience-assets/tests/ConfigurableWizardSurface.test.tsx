import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConfigurableWizardSurface from "../ConfigurableWizardSurface";

describe("ConfigurableWizardSurface", () => {
  it("renders page navigation, page host, and readiness summary", () => {
    const html = renderToStaticMarkup(
      <ConfigurableWizardSurface
        pages={[
          { id: "page-a", title: "Page A", status: "ready" },
          { id: "page-b", title: "Page B", status: "needs-input" },
        ]}
        activePageId="page-a"
        progress={{ totalCount: 2, completeCount: 1, readyCount: 1, focusLabel: "Page A" }}
        readiness={{
          title: "Readiness",
          description: "One blocker remains.",
          issues: [{ id: "issue-1", message: "Page B needs input", pageId: "page-b", status: "needs-input" }],
        }}
        renderPageHost={(pageId) => <div data-testid={`host-${pageId}`}>Host {pageId}</div>}
      />,
    );

    expect(html).toContain('data-testid="configurable-wizard-pages-card"');
    expect(html).toContain('data-testid="configurable-wizard-page-progress"');
    expect(html).toContain('data-testid="host-page-a"');
    expect(html).toContain('data-testid="configurable-wizard-readiness-summary"');
    expect(html).toContain("Page B needs input");
  });
});
