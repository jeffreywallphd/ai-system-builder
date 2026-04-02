import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { WorkflowStudioDraftAuthoringBoundaryProps } from "../../components/studio-shell/workflow/WorkflowStudioDraftAuthoringBoundary";
import WorkflowStudioDraftAuthoringBoundary from "../../components/studio-shell/workflow/WorkflowStudioDraftAuthoringBoundary";
import { SystemStudioDraftAuthoringBoundary as SystemStudioDraftAuthoringSurface } from "../../components/studio-shell/system/SystemStudioDraftAuthoringBoundary";
import DatasetStudioDraftAuthoringBoundary from "../../components/studio-shell/dataset/DatasetStudioDraftAuthoringBoundary";
import {
  StudioAssetRenderModes,
  type StudioAssetDefinition,
  type StudioHostContext,
  type StudioSessionState,
} from "./StudioAssetContracts";
import type { StudioEmbeddedEvent } from "./StudioEmbeddedEventContracts";
import type { ExperienceSurfaceAssetId } from "../experience-assets/ExperienceSurfaceAssets";

interface WorkflowStudioSurfaceInput {
  readonly content: string;
  readonly onChangeContent: (nextContent: string) => void;
  readonly isWorkflowStudio: boolean;
  readonly workflowModeContext?: WorkflowStudioDraftAuthoringBoundaryProps["workflowModeContext"];
  readonly invalidModeRouteId?: string;
  readonly invalidWizardPageRouteId?: string;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly embeddedVariant?: "behavior-automation";
}

interface SystemStudioSurfaceInput {
  readonly content: string;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly extensionContext: StudioShellExtensionContext;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
}

interface DatasetStudioSurfaceInput {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly embeddedVariant?: "inputs-outputs";
}

const baseCapabilities = Object.freeze({
  canNavigate: false,
  canShowShellChrome: false,
  canMutateDraft: true,
  canLaunchRuns: false,
  canManageSessionState: false,
});

export const workflowStudioSurfaceAssetDefinition: StudioAssetDefinition<WorkflowStudioSurfaceInput, StudioEmbeddedEvent> = Object.freeze({
  contract: Object.freeze({
    identity: Object.freeze({
      studioType: "workflow-studio",
      studioId: "workflow-studio",
      title: "Workflow Studio",
      summary: "Reusable authoring surface for guided and canvas workflow editing.",
    }),
    supportedModes: Object.freeze([
      StudioAssetRenderModes.full,
      StudioAssetRenderModes.embedded,
      StudioAssetRenderModes.inline,
      StudioAssetRenderModes.readonly,
    ]),
    accepts: Object.freeze({ context: "studio-host", document: "workflow-draft-json", input: Object.freeze({}) as WorkflowStudioSurfaceInput }),
    emits: Object.freeze(["studio.intent", "studio.change", "studio.validation"]),
    hostCapabilities: baseCapabilities,
  }),
  render: ({ context, onEvent }) => (
    <WorkflowStudioDraftAuthoringBoundary
      isWorkflowStudio={context.input.isWorkflowStudio}
      content={context.input.content}
      onChangeContent={context.input.onChangeContent}
      workflowModeContext={context.input.workflowModeContext}
      invalidModeRouteId={context.input.invalidModeRouteId}
      invalidWizardPageRouteId={context.input.invalidWizardPageRouteId}
      experienceAssetIds={context.input.experienceAssetIds}
      embeddedVariant={context.input.embeddedVariant}
      hostMode={context.mode}
      onStudioEvent={onEvent}
    />
  ),
});

export const systemStudioSurfaceAssetDefinition: StudioAssetDefinition<SystemStudioSurfaceInput, StudioEmbeddedEvent> = Object.freeze({
  contract: Object.freeze({
    identity: Object.freeze({
      studioType: "system-studio",
      studioId: "system-studio",
      title: "System Studio",
      summary: "Reusable authoring surface for system pages and composition.",
    }),
    supportedModes: Object.freeze([
      StudioAssetRenderModes.full,
      StudioAssetRenderModes.embedded,
      StudioAssetRenderModes.inline,
      StudioAssetRenderModes.readonly,
    ]),
    accepts: Object.freeze({ context: "studio-host", document: "system-draft-json", input: Object.freeze({}) as SystemStudioSurfaceInput }),
    emits: Object.freeze(["studio.intent", "studio.change", "studio.validation", "studio.runtime"]),
    hostCapabilities: baseCapabilities,
    runtimeHooks: Object.freeze({ canStartRuntime: true }),
  }),
  render: ({ context, onEvent }) => (
    <SystemStudioDraftAuthoringSurface
      content={context.input.content}
      validationIssues={context.input.validationIssues}
      extensionContext={context.input.extensionContext}
      experienceAssetIds={context.input.experienceAssetIds}
      hostMode={context.mode}
      onStudioEvent={onEvent}
    />
  ),
});

export const datasetStudioSurfaceAssetDefinition: StudioAssetDefinition<DatasetStudioSurfaceInput, StudioEmbeddedEvent> = Object.freeze({
  contract: Object.freeze({
    identity: Object.freeze({
      studioType: "dataset-studio",
      studioId: "dataset-studio",
      title: "Data Studio",
      summary: "Reusable authoring surface for stage-based data preparation.",
    }),
    supportedModes: Object.freeze([
      StudioAssetRenderModes.full,
      StudioAssetRenderModes.embedded,
      StudioAssetRenderModes.inline,
      StudioAssetRenderModes.readonly,
    ]),
    accepts: Object.freeze({ context: "studio-host", document: "dataset-draft-json", input: Object.freeze({}) as DatasetStudioSurfaceInput }),
    emits: Object.freeze(["studio.intent", "studio.change", "studio.validation", "studio.run"]),
    hostCapabilities: baseCapabilities,
  }),
  render: ({ context, onEvent }) => (
    <DatasetStudioDraftAuthoringBoundary
      content={context.input.content}
      extensionContext={context.input.extensionContext}
      experienceAssetIds={context.input.experienceAssetIds}
      embeddedVariant={context.input.embeddedVariant}
      hostMode={context.mode}
      onStudioEvent={onEvent}
    />
  ),
});

export function createStudioHostSessionState(snapshot: {
  readonly sessionId?: string;
  readonly draftId?: string;
  readonly isBusy: boolean;
  readonly operationError?: string;
}): StudioSessionState {
  return Object.freeze({
    sessionId: snapshot.sessionId,
    draftId: snapshot.draftId,
    isBusy: snapshot.isBusy,
    operationError: snapshot.operationError,
  });
}

export function createStudioHostContext<TInput>(params: {
  readonly input: TInput;
  readonly mode?: StudioHostContext<TInput>["mode"];
  readonly hostId?: string;
  readonly capabilities?: StudioHostContext<TInput>["capabilities"];
  readonly layout?: StudioHostContext<TInput>["layout"];
  readonly documentAccess?: StudioHostContext<TInput>["documentAccess"];
  readonly injectedContext?: StudioHostContext<TInput>["injectedContext"];
}): StudioHostContext<TInput> {
  return Object.freeze({
    hostId: params.hostId ?? "studio-shell",
    mode: params.mode ?? StudioAssetRenderModes.full,
    capabilities: params.capabilities ?? baseCapabilities,
    input: params.input,
    layout: params.layout,
    documentAccess: params.documentAccess,
    injectedContext: params.injectedContext,
  });
}
