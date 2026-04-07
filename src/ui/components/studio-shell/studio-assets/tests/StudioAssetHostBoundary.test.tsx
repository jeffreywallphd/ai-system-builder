import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudioAssetHostBoundary from "../StudioAssetHostBoundary";
import {
  createStudioHostContext,
  createStudioHostSessionState,
  datasetStudioSurfaceAssetDefinition,
  systemStudioSurfaceAssetDefinition,
  workflowStudioSurfaceAssetDefinition,
} from "../../../../studio-shell/studio-assets/StudioSurfaceAssetDefinitions";
import {
  StudioAssetRenderModes,
  StudioUiAssetKinds,
  type StudioAssetDefinition,
} from "../../../../studio-shell/studio-assets/StudioAssetContracts";
import { createEmptyWorkflowDraft, serializeWorkflowDraft } from "../../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { StudioShellExtensionContext } from "../../../../studio-shell/StudioShellExtensions";
import {
  StudioEmbeddedIntentKinds,
  createStudioIntentEvent,
  type StudioEmbeddedEvent,
} from "../../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";

const extensionContext: StudioShellExtensionContext = Object.freeze({
  studioId: "studio-1",
  snapshot: undefined,
  validationIssues: [],
  handoffContext: Object.freeze({}),
  isBusy: false,
  operations: Object.freeze({
    refresh: async () => undefined,
    setDraftContent: () => undefined,
  }),
});

describe("StudioAssetHostBoundary", () => {
  it("renders fallback messaging when host mode is unsupported", () => {
    const unsupportedAsset: StudioAssetDefinition<{ readonly value: string }> = Object.freeze({
      contract: Object.freeze({
        identity: Object.freeze({ studioType: "test", studioId: "test", title: "Test" }),
        kind: StudioUiAssetKinds.atomic,
        propsSchema: Object.freeze({ schemaId: "test.input", schemaVersion: "1.0.0" }),
        supportedModes: Object.freeze([StudioAssetRenderModes.full]),
        accepts: Object.freeze({ context: "test", document: "test", input: Object.freeze({ value: "" }) }),
        emits: Object.freeze([]),
        hostCapabilities: Object.freeze({
          canNavigate: false,
          canShowShellChrome: false,
          canMutateDraft: false,
          canLaunchRuns: false,
          canManageSessionState: false,
        }),
        rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
        persistence: Object.freeze({ documentType: "test", serialization: "json" }),
        capabilities: Object.freeze({ interactive: false, viewer: true }),
        constraints: Object.freeze({ allowsChildren: false }),
      }),
      render: () => <div>never</div>,
    });

    const html = renderToStaticMarkup(
      <StudioAssetHostBoundary
        asset={unsupportedAsset}
        context={createStudioHostContext({ mode: StudioAssetRenderModes.embedded, input: { value: "x" } })}
        session={createStudioHostSessionState({ isBusy: false })}
      />,
    );

    expect(html).toContain("This editor view is not available here yet.");
  });

  it("renders workflow studio in embedded mode without standalone validation notices", () => {
    const draft = createEmptyWorkflowDraft();
    const html = renderToStaticMarkup(
      <StudioAssetHostBoundary
        asset={workflowStudioSurfaceAssetDefinition}
        context={createStudioHostContext({
          mode: StudioAssetRenderModes.embedded,
          input: {
            isWorkflowStudio: true,
            content: serializeWorkflowDraft(draft),
            onChangeContent: () => undefined,
            invalidWizardPageRouteId: "bad-page",
            workflowModeContext: {
              selectedModeId: "canvas",
              selectedWizardPageId: "trigger",
              sharedDraft: draft,
              sharedDraftSerialized: serializeWorkflowDraft(draft),
              draftEditorContent: serializeWorkflowDraft(draft),
              draftParseError: "invalid",
              modeValidationIssues: [{ code: "mode-issue", severity: "error", message: "issue" }],
              draftValidationIssues: [{ code: "draft-issue", section: "steps", severity: "error", message: "issue" }],
            },
          },
        })}
        session={createStudioHostSessionState({ isBusy: false })}
      />,
    );

    expect(html).toContain('data-testid="workflow-studio-canvas-mode-surface"');
    expect(html).not.toContain("Workflow mode validation:");
    expect(html).not.toContain("Shared workflow draft validation:");
    expect(html).not.toContain("Unsupported wizard page route");
  });

  it("renders dataset and system studio surfaces in embedded mode", () => {
    const datasetHtml = renderToStaticMarkup(
      <StudioAssetHostBoundary
        asset={datasetStudioSurfaceAssetDefinition}
        context={createStudioHostContext({
          mode: StudioAssetRenderModes.embedded,
          input: {
            content: "{}",
            extensionContext,
          },
        })}
        session={createStudioHostSessionState({ isBusy: false })}
      />,
    );

    const systemHtml = renderToStaticMarkup(
      <StudioAssetHostBoundary
        asset={systemStudioSurfaceAssetDefinition}
        context={createStudioHostContext({
          mode: StudioAssetRenderModes.embedded,
          input: {
            content: "{}",
            validationIssues: [],
            extensionContext,
          },
        })}
        session={createStudioHostSessionState({ isBusy: false })}
      />,
    );

    expect(datasetHtml).toContain('data-testid="data-studio-preparation-wizard-panel"');
    expect(datasetHtml).not.toContain('data-testid="experience-asset-mode-actions"');
    expect(systemHtml).toContain('data-testid="system-studio-draft-authoring-boundary"');
  });

  it("applies host sizing constraints from context", () => {
    const html = renderToStaticMarkup(
      <StudioAssetHostBoundary
        asset={datasetStudioSurfaceAssetDefinition}
        context={createStudioHostContext({
          mode: StudioAssetRenderModes.embedded,
          layout: Object.freeze({ minHeight: 320, maxWidth: 640, width: "100%" }),
          input: {
            content: "{}",
            extensionContext,
          },
        })}
        session={createStudioHostSessionState({ isBusy: false })}
      />,
    );

    expect(html).toContain("min-height:320px");
    expect(html).toContain("max-width:640px");
    expect(html).toContain("width:100%");
  });

  it("blocks navigation intents when host navigation capability is disabled", () => {
    let emittedCount = 0;
    const emittingAsset: StudioAssetDefinition<{ readonly value: string }, StudioEmbeddedEvent> = Object.freeze({
      contract: Object.freeze({
        identity: Object.freeze({ studioType: "test", studioId: "test", title: "Test" }),
        kind: StudioUiAssetKinds.atomic,
        propsSchema: Object.freeze({ schemaId: "test.input", schemaVersion: "1.0.0" }),
        supportedModes: Object.freeze([StudioAssetRenderModes.embedded]),
        accepts: Object.freeze({ context: "test", document: "test", input: Object.freeze({ value: "" }) }),
        emits: Object.freeze(["studio.intent"]),
        hostCapabilities: Object.freeze({
          canNavigate: false,
          canShowShellChrome: false,
          canMutateDraft: false,
          canLaunchRuns: false,
          canManageSessionState: false,
        }),
        rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
        persistence: Object.freeze({ documentType: "test", serialization: "json" }),
        capabilities: Object.freeze({ interactive: true, viewer: false }),
        constraints: Object.freeze({ allowsChildren: false }),
      }),
      render: ({ onEvent }) => {
        onEvent?.(createStudioIntentEvent({
          kind: StudioEmbeddedIntentKinds.openResource,
          payload: Object.freeze({ resourceType: "workflow", resourceId: "wf-1" }),
        }));
        return <div>emit</div>;
      },
    });

    renderToStaticMarkup(
      <StudioAssetHostBoundary
        asset={emittingAsset}
        context={createStudioHostContext({
          mode: StudioAssetRenderModes.embedded,
          capabilities: Object.freeze({
            canNavigate: false,
            canShowShellChrome: true,
            canMutateDraft: true,
            canLaunchRuns: false,
            canManageSessionState: false,
          }),
          input: { value: "x" },
        })}
        session={createStudioHostSessionState({ isBusy: false })}
        onEvent={() => {
          emittedCount += 1;
        }}
      />,
    );

    expect(emittedCount).toBe(0);
  });
});
