import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { WorkflowStudioDraftAuthoringBoundaryProps } from "../../components/studio-shell/workflow/WorkflowStudioDraftAuthoringBoundary";
import WorkflowStudioDraftAuthoringBoundary from "../../components/studio-shell/workflow/WorkflowStudioDraftAuthoringBoundary";
import { SystemStudioDraftAuthoringBoundary as SystemStudioDraftAuthoringSurface } from "../../components/studio-shell/system/SystemStudioDraftAuthoringBoundary";
import DatasetStudioDraftAuthoringBoundary from "../../components/studio-shell/dataset/DatasetStudioDraftAuthoringBoundary";
import {
  StudioAssetPropertyFieldKinds,
  StudioUiAssetKinds,
  StudioUiAssetContractVersion,
  SystemPageLayoutKinds,
  StudioAssetRenderModes,
  type StudioAssetDefinition,
  type StudioHostContext,
  type StudioUiAssetKind,
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

const defaultComposedUiSlot = Object.freeze({
  slotId: "main",
  label: "Main content",
  required: true,
  allowsMultiple: false,
  allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
  allowedRegistrationCategories: Object.freeze(["atomic-ui", "composed-ui"] as const),
});

const defaultSystemPageRegions = Object.freeze([
  Object.freeze({
    regionId: "navigation",
    label: "Navigation rail",
    required: true,
    allowsMultiple: false,
    allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
    allowedRegistrationCategories: Object.freeze(["atomic-ui", "composed-ui"] as const),
  }),
  Object.freeze({
    regionId: "workspace",
    label: "Primary workspace",
    required: true,
    allowsMultiple: false,
    allowedChildKinds: Object.freeze([
      StudioUiAssetKinds.atomic,
      StudioUiAssetKinds.composed,
      StudioUiAssetKinds.systemPage,
    ]),
    allowedRegistrationCategories: Object.freeze(["atomic-ui", "composed-ui", "system-page"] as const),
  }),
  Object.freeze({
    regionId: "inspector",
    label: "Inspector panel",
    required: true,
    allowsMultiple: false,
    allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
    allowedRegistrationCategories: Object.freeze(["atomic-ui", "composed-ui"] as const),
  }),
]);

export const workflowStudioSurfaceAssetDefinition: StudioAssetDefinition<WorkflowStudioSurfaceInput, StudioEmbeddedEvent> = Object.freeze({
  contract: Object.freeze({
    contractVersion: StudioUiAssetContractVersion,
    identity: Object.freeze({
      studioType: "workflow-studio",
      studioId: "workflow-studio",
      title: "Workflow Studio",
      summary: "Reusable authoring surface for guided and canvas workflow editing.",
    }),
    kind: StudioUiAssetKinds.composed,
    metadata: Object.freeze({
      displayName: "Workflow Studio Surface",
      description: "Composed studio authoring surface for workflow structures and behavior.",
      group: "studio-surfaces",
      iconToken: "studio.workflow",
      tags: Object.freeze(["studio", "workflow", "composed-ui"]),
      keywords: Object.freeze(["workflow", "wizard", "canvas", "orchestration"]),
      contractCategory: "composed-ui",
      capabilityFlags: Object.freeze(["nested-studios", "authoring"]),
    }),
    propsSchema: Object.freeze({
      schemaId: "studio.workflow-surface.input",
      schemaVersion: "1.0.0",
      propertySchema: Object.freeze({
        schemaId: "studio.workflow-surface.properties",
        schemaVersion: "1.0.0",
        sections: Object.freeze([
          Object.freeze({
            id: "overview",
            label: "Overview",
            fields: Object.freeze([
              Object.freeze({
                id: "content",
                path: "content",
                label: "Draft content",
                kind: StudioAssetPropertyFieldKinds.textarea,
                helpText: "Raw draft JSON/text used by this workflow surface.",
                defaultValue: "",
              }),
              Object.freeze({
                id: "isWorkflowStudio",
                path: "isWorkflowStudio",
                label: "Enable workflow authoring tools",
                kind: StudioAssetPropertyFieldKinds.boolean,
                defaultValue: true,
              }),
            ]),
          }),
          Object.freeze({
            id: "advanced",
            label: "Advanced",
            fields: Object.freeze([
              Object.freeze({
                id: "embeddedVariant",
                path: "embeddedVariant",
                label: "Embedded variant",
                kind: StudioAssetPropertyFieldKinds.select,
                defaultValue: "",
                options: Object.freeze([
                  Object.freeze({ value: "", label: "Default" }),
                  Object.freeze({ value: "behavior-automation", label: "Behavior automation" }),
                ]),
              }),
            ]),
          }),
        ]),
      }),
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
    rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
    persistence: Object.freeze({ documentType: "workflow-draft-json", serialization: "json" }),
    childSlots: Object.freeze([defaultComposedUiSlot]),
    compositionRules: Object.freeze({
      allowsNestedStudios: true,
      allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
    }),
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
    contractVersion: StudioUiAssetContractVersion,
    identity: Object.freeze({
      studioType: "system-studio",
      studioId: "system-studio",
      title: "System Studio",
      summary: "Reusable authoring surface for system pages and composition.",
    }),
    kind: StudioUiAssetKinds.systemPage,
    metadata: Object.freeze({
      displayName: "System Studio Surface",
      description: "Composed studio authoring surface supporting nested studio composition.",
      group: "studio-surfaces",
      iconToken: "studio.system",
      tags: Object.freeze(["studio", "system", "composed-ui"]),
      keywords: Object.freeze(["system", "runtime", "page", "composition"]),
      contractCategory: "system-page",
      capabilityFlags: Object.freeze(["nested-pages", "runtime"]),
    }),
    propsSchema: Object.freeze({
      schemaId: "studio.system-surface.input",
      schemaVersion: "1.0.0",
      propertySchema: Object.freeze({
        schemaId: "studio.system-surface.properties",
        schemaVersion: "1.0.0",
        sections: Object.freeze([
          Object.freeze({
            id: "content",
            label: "Content",
            fields: Object.freeze([
              Object.freeze({
                id: "content",
                path: "content",
                label: "Draft content",
                kind: StudioAssetPropertyFieldKinds.textarea,
                defaultValue: "",
              }),
            ]),
          }),
        ]),
      }),
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
    rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
    persistence: Object.freeze({ documentType: "system-draft-json", serialization: "json" }),
    pageStructure: Object.freeze({
      layoutKind: SystemPageLayoutKinds.workspace,
      regions: defaultSystemPageRegions,
      defaultRegionId: "workspace",
    }),
    layoutResponsibilities: Object.freeze([
      "compose-child-assets",
      "host-runtime-status",
      "present-system-navigation",
    ]),
    panelReferences: Object.freeze(["system-components", "system-bindings", "system-runtime"]),
    navigation: Object.freeze({
      route: "/studio-shell/system",
      title: "System Studio",
      supportsDeepLinking: true,
      navGroup: "studio-shell",
      requiresRuntimeSession: false,
    }),
    compositionRules: Object.freeze({
      allowsNestedPages: true,
      allowedChildKinds: Object.freeze([
        StudioUiAssetKinds.atomic,
        StudioUiAssetKinds.composed,
        StudioUiAssetKinds.systemPage,
      ]),
    }),
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
    contractVersion: StudioUiAssetContractVersion,
    identity: Object.freeze({
      studioType: "dataset-studio",
      studioId: "dataset-studio",
      title: "Data Studio",
      summary: "Reusable authoring surface for stage-based data preparation.",
    }),
    kind: StudioUiAssetKinds.composed,
    metadata: Object.freeze({
      displayName: "Dataset Studio Surface",
      description: "Composed studio authoring surface for multi-step data preparation flows.",
      group: "studio-surfaces",
      iconToken: "studio.dataset",
      tags: Object.freeze(["studio", "dataset", "composed-ui"]),
      keywords: Object.freeze(["dataset", "preparation", "pipeline", "stages"]),
      contractCategory: "composed-ui",
      capabilityFlags: Object.freeze(["nested-studios", "preview"]),
    }),
    propsSchema: Object.freeze({
      schemaId: "studio.dataset-surface.input",
      schemaVersion: "1.0.0",
      propertySchema: Object.freeze({
        schemaId: "studio.dataset-surface.properties",
        schemaVersion: "1.0.0",
        sections: Object.freeze([
          Object.freeze({
            id: "content",
            label: "Data studio settings",
            fields: Object.freeze([
              Object.freeze({
                id: "content",
                path: "content",
                label: "Draft content",
                kind: StudioAssetPropertyFieldKinds.textarea,
                defaultValue: "",
              }),
              Object.freeze({
                id: "embeddedVariant",
                path: "embeddedVariant",
                label: "Embedded variant",
                kind: StudioAssetPropertyFieldKinds.select,
                defaultValue: "",
                options: Object.freeze([
                  Object.freeze({ value: "", label: "Default" }),
                  Object.freeze({ value: "inputs-outputs", label: "Inputs & outputs" }),
                ]),
              }),
            ]),
          }),
        ]),
      }),
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
    rendering: Object.freeze({ renderer: "react", resolution: "definition-render" }),
    persistence: Object.freeze({ documentType: "dataset-draft-json", serialization: "json" }),
    childSlots: Object.freeze([defaultComposedUiSlot]),
    compositionRules: Object.freeze({
      allowsNestedStudios: true,
      allowedChildKinds: Object.freeze([StudioUiAssetKinds.atomic, StudioUiAssetKinds.composed]),
    }),
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

export const studioSurfaceAssetDefinitions = Object.freeze([
  workflowStudioSurfaceAssetDefinition,
  datasetStudioSurfaceAssetDefinition,
  systemStudioSurfaceAssetDefinition,
]);

export function resolveStudioSurfaceAssetDefinitionById(studioId: string): StudioAssetDefinition<unknown, StudioEmbeddedEvent> | undefined {
  return studioSurfaceAssetDefinitions.find((entry) => entry.contract.identity.studioId === studioId) as StudioAssetDefinition<unknown, StudioEmbeddedEvent> | undefined;
}

export function listStudioSurfaceAssetDefinitionsByKind(kind: StudioUiAssetKind): ReadonlyArray<StudioAssetDefinition<unknown, StudioEmbeddedEvent>> {
  return Object.freeze(
    studioSurfaceAssetDefinitions.filter((entry) => entry.contract.kind === kind) as ReadonlyArray<StudioAssetDefinition<unknown, StudioEmbeddedEvent>>,
  );
}

export function listStudioSurfaceAssetDefinitionsByContractKind(
  kind: StudioUiAssetKind,
): ReadonlyArray<StudioAssetDefinition<unknown, StudioEmbeddedEvent>> {
  return listStudioSurfaceAssetDefinitionsByKind(kind);
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
