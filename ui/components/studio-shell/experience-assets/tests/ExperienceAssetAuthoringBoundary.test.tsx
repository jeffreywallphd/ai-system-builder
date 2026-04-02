import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExperienceAssetAuthoringBoundary from "../DEPRECATED_ExperienceAssetAuthoringBoundary";
import { ExperienceAssetModeIds, type ExperienceAssetDefinition } from "../../../../studio-shell/experience-assets/ExperienceAssetContracts";

interface DemoDocument {
  readonly name: string;
}

interface DemoIssue {
  readonly code: string;
}

const definition: ExperienceAssetDefinition<DemoDocument, DemoIssue> = Object.freeze({
  id: "demo",
  title: "Demo",
  defaultModeId: ExperienceAssetModeIds.wizard,
  modes: Object.freeze([
    Object.freeze({ id: ExperienceAssetModeIds.wizard, title: "Wizard", summary: "Guided", intent: "guided-authoring" }),
    Object.freeze({ id: ExperienceAssetModeIds.canvas, title: "Canvas", summary: "Graph", intent: "graph-authoring" }),
  ]),
  wizard: Object.freeze({ id: "wizard", title: "Wizard", summary: "Guided" }),
  canvas: Object.freeze({ id: "canvas", title: "Canvas", summary: "Graph" }),
});

describe("DEPRECATED_ExperienceAssetAuthoringBoundary", () => {
  it("renders mode-specific surfaces based on the active mode", () => {
    const html = renderToStaticMarkup(
      <ExperienceAssetAuthoringBoundary
        asset={definition}
        activeModeId="wizard"
        document={{ name: "demo" }}
        issues={[]}
        surfaces={{
          wizard: () => <div data-testid="wizard-surface">wizard</div>,
          canvas: () => <div data-testid="canvas-surface">canvas</div>,
        }}
      />, 
    );

    expect(html).toContain('data-testid="wizard-surface"');
    expect(html).not.toContain('data-testid="canvas-surface"');
  });

  it("shows a fallback mode selection message when the requested mode is invalid", () => {
    const html = renderToStaticMarkup(
      <ExperienceAssetAuthoringBoundary
        asset={definition}
        activeModeId="canvas"
        invalidModeId="unknown"
        document={{ name: "demo" }}
        issues={[]}
        surfaces={{
          canvas: () => <div>canvas</div>,
        }}
      />,
    );

    expect(html).toContain("Unsupported experience mode selection");
    expect(html).toContain("unknown");
    expect(html).toContain("using canvas mode");
  });
});
