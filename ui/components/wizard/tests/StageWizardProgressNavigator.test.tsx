import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StageWizardProgressNavigator from "../StageWizardProgressNavigator";

describe("StageWizardProgressNavigator", () => {
  it("renders current/completed/skipped/disabled stage progress cues", () => {
    const html = renderToStaticMarkup(
      React.createElement(StageWizardProgressNavigator, {
        title: "Dataset stage wizard",
        steps: Object.freeze([
          Object.freeze({ id: "source", name: "Source", description: "Select source.", order: 1, status: "completed", isDisabled: false }),
          Object.freeze({ id: "ingestion", name: "Ingestion", description: "Ingest source.", order: 2, status: "current", isDisabled: false }),
          Object.freeze({ id: "profiling", name: "Profiling", description: "Optional profiling.", order: 3, status: "skipped", isDisabled: false }),
          Object.freeze({ id: "preview", name: "Preview", description: "Preview output.", order: 4, status: "disabled", isDisabled: true }),
        ]),
      }),
    );

    expect(html).toContain("Current");
    expect(html).toContain("Completed");
    expect(html).toContain("Skipped");
    expect(html).toContain("Unavailable");
  });
});
