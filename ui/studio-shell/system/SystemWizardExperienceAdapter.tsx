import type { JSX } from "react";
import ConfigurableCanvasSurface from "../../components/studio-shell/experience-assets/ConfigurableCanvasSurface";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { CanvasExperienceAssetDefinition } from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type { WizardExperienceAssetDefinition } from "../experience-assets/ConfigurableWizardSurfaceContracts";
import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import { parseSystemStudioDraftDocument, type SystemStudioDraftDocument } from "./SystemStudioDraftDocument";
import { SystemInterfaceEditor } from "../../components/studio-shell/SystemInterfaceEditor";
import { SystemParameterConfigEditor } from "../../components/studio-shell/SystemParameterConfigEditor";
import { SystemPageSetupEditor } from "../../components/studio-shell/system/SystemPageSetupEditor";
import { SystemSettingsEditor } from "../../components/studio-shell/system/SystemSettingsEditor";
import type { SystemCanvasExperienceContext } from "./SystemCanvasExperienceAdapter";
import StudioAssetHostBoundary from "../../components/studio-shell/studio-assets/StudioAssetHostBoundary";
import {
  createStudioHostContext,
  createStudioHostSessionState,
  datasetStudioSurfaceAssetDefinition,
  workflowStudioSurfaceAssetDefinition,
} from "../studio-assets/StudioSurfaceAssetDefinitions";
import { StudioAssetRenderModes, type StudioHostContext } from "../studio-assets/StudioAssetContracts";
import type { StudioEmbeddedEvent, StudioEmbeddedEventEnvelope } from "../studio-assets/StudioEmbeddedEventContracts";
import { ExperienceSurfaceAssetIds, type ExperienceSurfaceAssetId } from "../experience-assets/ExperienceSurfaceAssets";

export const SystemWizardPageIds = Object.freeze({
  pages: "pages",
  interfaceDesign: "interface-design",
  inputsOutputs: "inputs-outputs",
  behaviorAutomation: "behavior-automation",
  settings: "settings",
});

export type SystemWizardPageId = typeof SystemWizardPageIds[keyof typeof SystemWizardPageIds];

export interface SystemWizardExperienceContext {
  readonly extensionContext: StudioShellExtensionContext;
  readonly document: SystemStudioDraftDocument;
  readonly issues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onPagesChange: (pages: SystemStudioDraftDocument["systemSpec"]["pages"]) => void;
  readonly canvasDefinition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext>;
  readonly canvasContext: SystemCanvasExperienceContext;
  readonly embeddedDatasetContent: string;
  readonly embeddedDatasetExtensionContext: StudioShellExtensionContext;
  readonly embeddedWorkflowContent: string;
  readonly embeddedWorkflowExtensionContext: StudioShellExtensionContext;
  readonly onEmbeddedStudioEvent?: (event: StudioEmbeddedEventEnvelope) => void;
}

export interface SystemWizardExperienceAdapterInput {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onPagesChange: (pages: SystemStudioDraftDocument["systemSpec"]["pages"]) => void;
  readonly canvasDefinition: CanvasExperienceAssetDefinition<SystemCanvasExperienceContext>;
  readonly canvasContext: SystemCanvasExperienceContext;
  readonly embeddedDatasetContent: string;
  readonly embeddedDatasetExtensionContext: StudioShellExtensionContext;
  readonly embeddedWorkflowContent: string;
  readonly embeddedWorkflowExtensionContext: StudioShellExtensionContext;
  readonly onEmbeddedStudioEvent?: (event: StudioEmbeddedEventEnvelope) => void;
}

function toStatus(ready: boolean): "ready" | "pending" {
  return ready ? "ready" : "pending";
}

function resolveInterfaceDesignReadiness(document: SystemStudioDraftDocument): boolean {
  if (document.systemSpec.pages.length === 0) {
    return false;
  }
  return document.systemSpec.pages.every((page) => {
    const layout = document.canvasAuthoring.pageLayouts.find((entry) => entry.pageId === page.pageId);
    return (layout?.panels.length ?? 0) > 0;
  });
}

function renderPagesPage(context: SystemWizardExperienceContext): JSX.Element {
  return (
    <SystemPageSetupEditor
      pages={context.document.systemSpec.pages}
      selectedPageId={context.selectedPageId}
      onSelectPage={context.onSelectPage}
      onPagesChange={context.onPagesChange}
    />
  );
}

function renderInterfaceDesignPage(context: SystemWizardExperienceContext): JSX.Element {
  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-wizard-interface-design-page">
      <div className="ui-stack ui-stack--2xs">
        <p className="ui-text-small ui-text-secondary">Pick a page, then arrange its major sections. Detailed panel content is designed in each panel's embedded studio.</p>
        <div className="ui-row ui-row--wrap" data-testid="system-wizard-page-switcher">
          {context.document.systemSpec.pages.map((page) => (
            <button
              key={page.pageId}
              type="button"
              className={`ui-button ui-button--sm ${page.pageId === context.selectedPageId ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => context.onSelectPage(page.pageId)}
            >
              {page.title}
            </button>
          ))}
        </div>
      </div>
      <ConfigurableCanvasSurface
        definition={context.canvasDefinition}
        definitionContext={context.canvasContext}
      />
    </section>
  );
}

function renderInputsOutputsPage(context: SystemWizardExperienceContext): JSX.Element {
  const datasetHostContext: StudioHostContext<{
    readonly content: string;
    readonly extensionContext: StudioShellExtensionContext;
    readonly experienceAssetIds: ReadonlyArray<ExperienceSurfaceAssetId>;
  }> = createStudioHostContext({
    hostId: "system-studio-wizard-inputs-outputs",
    mode: StudioAssetRenderModes.embedded,
    capabilities: Object.freeze({
      canNavigate: false,
      canShowShellChrome: false,
      canMutateDraft: true,
      canLaunchRuns: false,
      canManageSessionState: false,
    }),
    input: Object.freeze({
      content: context.embeddedDatasetContent,
      extensionContext: context.embeddedDatasetExtensionContext,
      experienceAssetIds: Object.freeze([ExperienceSurfaceAssetIds.loomWizard]),
      embeddedVariant: "inputs-outputs" as const,
    }),
    documentAccess: Object.freeze({
      readOnly: false,
      readDocument: () => context.extensionContext.snapshot?.draft?.content ?? "",
      updateDocument: (nextContent: string) => {
        context.extensionContext.operations.setDraftContent?.(nextContent);
      },
    }),
    injectedContext: Object.freeze({
      sharedDocumentBoundary: "systemSpec.sharedDocument",
      synchronizedScope: "dataset-definitions",
    }),
  });

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-wizard-inputs-outputs-page">
      <div className="ui-stack ui-stack--2xs">
        <p className="ui-text-small ui-text-secondary">
          Set up what comes in and what people get back, all in one place.
        </p>
      </div>
      <section className="ui-card ui-card--padded ui-stack ui-stack--sm">
        <div className="ui-stack ui-stack--2xs">
          <strong>Data setup</strong>
          <p className="ui-text-small ui-text-secondary">
            Add or edit the information this system uses.
          </p>
        </div>
        <StudioAssetHostBoundary
          asset={datasetStudioSurfaceAssetDefinition}
          context={datasetHostContext}
          session={createStudioHostSessionState({
            sessionId: context.extensionContext.snapshot?.activeSessionId,
            draftId: context.extensionContext.snapshot?.draft?.draftId,
            isBusy: context.extensionContext.isBusy,
            operationError: context.extensionContext.operationError,
          })}
          onEvent={(event) => {
            if (!context.onEmbeddedStudioEvent) {
              return;
            }
            context.onEmbeddedStudioEvent({
              event: event as StudioEmbeddedEvent,
              source: Object.freeze({
                studioType: datasetStudioSurfaceAssetDefinition.contract.identity.studioType,
                studioId: datasetStudioSurfaceAssetDefinition.contract.identity.studioId,
                hostId: datasetHostContext.hostId,
                mode: datasetHostContext.mode,
              }),
            });
          }}
        />
      </section>
      <details className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <summary className="ui-text-small">Advanced interface details</summary>
        <SystemInterfaceEditor context={context.extensionContext} />
      </details>
    </section>
  );
}

function renderSettingsPage(context: SystemWizardExperienceContext): JSX.Element {
  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-wizard-settings-page">
      <SystemSettingsEditor context={context.extensionContext} />
      <details className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <summary className="ui-text-small">Advanced parameters</summary>
        <SystemParameterConfigEditor context={context.extensionContext} />
      </details>
    </section>
  );
}

function renderBehaviorAutomationPage(context: SystemWizardExperienceContext): JSX.Element {
  const workflowHostContext = createStudioHostContext({
    hostId: "system-studio-wizard-behavior-automation",
    mode: StudioAssetRenderModes.embedded,
    capabilities: Object.freeze({
      canNavigate: false,
      canShowShellChrome: false,
      canMutateDraft: true,
      canLaunchRuns: false,
      canManageSessionState: false,
    }),
    input: Object.freeze({
      content: context.embeddedWorkflowContent,
      onChangeContent: (nextContent: string) => {
        context.embeddedWorkflowExtensionContext.operations.setDraftContent?.(nextContent);
      },
      isWorkflowStudio: true,
      experienceAssetIds: Object.freeze([ExperienceSurfaceAssetIds.loomWizard]),
      embeddedVariant: "behavior-automation" as const,
    }),
    documentAccess: Object.freeze({
      readOnly: false,
      readDocument: () => context.extensionContext.snapshot?.draft?.content ?? "",
      updateDocument: (nextContent: string) => {
        context.extensionContext.operations.setDraftContent?.(nextContent);
      },
    }),
    injectedContext: Object.freeze({
      sharedDocumentBoundary: "systemSpec.sharedDocument",
      synchronizedScope: "workflow-definitions",
    }),
  });

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-wizard-behavior-automation-page">
      <div className="ui-stack ui-stack--2xs">
        <p className="ui-text-small ui-text-secondary">
          Define how the system responds and what it does automatically.
        </p>
      </div>
      <section className="ui-card ui-card--padded ui-stack ui-stack--sm">
        <StudioAssetHostBoundary
          asset={workflowStudioSurfaceAssetDefinition}
          context={workflowHostContext}
          session={createStudioHostSessionState({
            sessionId: context.extensionContext.snapshot?.activeSessionId,
            draftId: context.extensionContext.snapshot?.draft?.draftId,
            isBusy: context.extensionContext.isBusy,
            operationError: context.extensionContext.operationError,
          })}
          onEvent={(event) => {
            if (!context.onEmbeddedStudioEvent) {
              return;
            }
            context.onEmbeddedStudioEvent({
              event: event as StudioEmbeddedEvent,
              source: Object.freeze({
                studioType: workflowStudioSurfaceAssetDefinition.contract.identity.studioType,
                studioId: workflowStudioSurfaceAssetDefinition.contract.identity.studioId,
                hostId: workflowHostContext.hostId,
                mode: workflowHostContext.mode,
              }),
            });
          }}
        />
      </section>
    </section>
  );
}

const definition: WizardExperienceAssetDefinition<SystemWizardExperienceContext> = Object.freeze({
  id: "system-authoring-wizard",
  title: "System authoring wizard",
  summary: "Guided setup flow for system assets.",
  pages: Object.freeze([
    Object.freeze({
      id: SystemWizardPageIds.pages,
      title: "Pages",
      summary: "Create and describe the pages people will use.",
      resolveStatus: (context) => toStatus(context.document.systemSpec.pages.every((page) => page.title.trim().length > 0)),
      render: renderPagesPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.interfaceDesign,
      title: "Interface Design",
      summary: "Arrange each page in the design canvas.",
      resolveStatus: (context) => toStatus(resolveInterfaceDesignReadiness(context.document)),
      render: renderInterfaceDesignPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.inputsOutputs,
      title: "Inputs & Outputs",
      summary: "Define what information comes in and what is produced.",
      resolveStatus: (context) => toStatus(
        context.document.systemSpec.inputs.length > 0
          || context.document.systemSpec.outputs.length > 0
          || context.embeddedDatasetContent.trim().length > 0,
      ),
      render: renderInputsOutputsPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.behaviorAutomation,
      title: "Behavior & Automation",
      summary: "Set up guided behavior rules and automation flow.",
      resolveStatus: (context) => toStatus(context.embeddedWorkflowContent.trim().length > 0),
      render: renderBehaviorAutomationPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.settings,
      title: "Settings",
      summary: "Set reusable behavior and defaults.",
      resolveStatus: (context) => toStatus(context.document.systemSpec.settings.systemName.trim().length > 0),
      render: renderSettingsPage,
    }),
  ]),
  resolveProgress: ({ context, activePageId }) => {
    const pages = [
      {
        id: SystemWizardPageIds.pages,
        ready: context.document.systemSpec.pages.length > 0 && context.document.systemSpec.pages.every((page) => page.title.trim().length > 0),
        title: "Pages",
      },
      {
        id: SystemWizardPageIds.interfaceDesign,
        ready: resolveInterfaceDesignReadiness(context.document),
        title: "Interface Design",
      },
      {
        id: SystemWizardPageIds.inputsOutputs,
        ready: context.document.systemSpec.inputs.length > 0
          || context.document.systemSpec.outputs.length > 0
          || context.embeddedDatasetContent.trim().length > 0,
        title: "Inputs & Outputs",
      },
      {
        id: SystemWizardPageIds.behaviorAutomation,
        ready: context.embeddedWorkflowContent.trim().length > 0,
        title: "Behavior & Automation",
      },
      { id: SystemWizardPageIds.settings, ready: context.document.systemSpec.settings.systemName.trim().length > 0, title: "Settings" },
    ] as const;
    const readyCount = pages.filter((page) => page.ready).length;
    return Object.freeze({
      totalCount: pages.length,
      completeCount: readyCount,
      readyCount,
      focusLabel: pages.find((page) => page.id === activePageId)?.title ?? "Pages",
    });
  },
  resolveReadiness: (context) => Object.freeze({
    title: "System setup readiness",
    description: context.document.systemSpec.pages.length === 0
      ? "Start by adding your first page."
      : context.document.systemSpec.pages.some((page) => page.title.trim().length === 0)
        ? "Give each page a title so people can find what they need."
        : !resolveInterfaceDesignReadiness(context.document)
          ? "Add at least one panel to each page in Interface Design."
          : context.embeddedWorkflowContent.trim().length === 0
            ? "Add behavior and automation details to guide how this system runs."
          : "Your setup is ready. You can keep refining inputs, outputs, and settings.",
    issues: Object.freeze(
      context.issues.map((issue) => Object.freeze({
        id: `${issue.code}:${issue.path ?? ""}:${issue.message}`,
        message: issue.message,
      })),
    ),
  }),
});

export function createSystemWizardExperienceAdapterModel(
  input: SystemWizardExperienceAdapterInput,
): {
  readonly definition: WizardExperienceAssetDefinition<SystemWizardExperienceContext>;
  readonly context: SystemWizardExperienceContext;
} {
  return Object.freeze({
    definition,
    context: Object.freeze({
      extensionContext: input.extensionContext,
      document: parseSystemStudioDraftDocument(input.content),
      issues: input.validationIssues,
      selectedPageId: input.selectedPageId,
      onSelectPage: input.onSelectPage,
      onPagesChange: input.onPagesChange,
      canvasDefinition: input.canvasDefinition,
      canvasContext: input.canvasContext,
      embeddedDatasetContent: input.embeddedDatasetContent,
      embeddedDatasetExtensionContext: input.embeddedDatasetExtensionContext,
      embeddedWorkflowContent: input.embeddedWorkflowContent,
      embeddedWorkflowExtensionContext: input.embeddedWorkflowExtensionContext,
      onEmbeddedStudioEvent: input.onEmbeddedStudioEvent,
    }),
  });
}
