import type { JSX } from "react";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { WizardExperienceAssetDefinition } from "../experience-assets/ConfigurableWizardSurfaceContracts";
import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import { parseSystemStudioDraftDocument, type SystemStudioDraftDocument } from "./SystemStudioDraftDocument";
import { SystemCompositionEditor } from "../../components/studio-shell/SystemCompositionEditor";
import { SystemInterfaceEditor } from "../../components/studio-shell/SystemInterfaceEditor";
import { SystemParameterConfigEditor } from "../../components/studio-shell/SystemParameterConfigEditor";
import { SystemPageSetupEditor } from "../../components/studio-shell/system/SystemPageSetupEditor";

export const SystemWizardPageIds = Object.freeze({
  pages: "pages",
  composition: "composition",
  interfaces: "interfaces",
  parameters: "parameters",
});

export type SystemWizardPageId = typeof SystemWizardPageIds[keyof typeof SystemWizardPageIds];

export interface SystemWizardExperienceContext {
  readonly extensionContext: StudioShellExtensionContext;
  readonly document: SystemStudioDraftDocument;
  readonly issues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onPagesChange: (pages: SystemStudioDraftDocument["systemSpec"]["pages"]) => void;
}

export interface SystemWizardExperienceAdapterInput {
  readonly content: string;
  readonly extensionContext: StudioShellExtensionContext;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
  readonly selectedPageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly onPagesChange: (pages: SystemStudioDraftDocument["systemSpec"]["pages"]) => void;
}

function toStatus(ready: boolean): "ready" | "pending" {
  return ready ? "ready" : "pending";
}

function renderCompositionPage(context: SystemWizardExperienceContext): JSX.Element {
  return <SystemCompositionEditor context={context.extensionContext} />;
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

function renderInterfacesPage(context: SystemWizardExperienceContext): JSX.Element {
  return <SystemInterfaceEditor context={context.extensionContext} />;
}

function renderParametersPage(context: SystemWizardExperienceContext): JSX.Element {
  return <SystemParameterConfigEditor context={context.extensionContext} />;
}

const definition: WizardExperienceAssetDefinition<SystemWizardExperienceContext> = Object.freeze({
  id: "system-authoring-wizard",
  title: "System authoring wizard",
  summary: "Guided composition flow for system assets.",
  pages: Object.freeze([
    Object.freeze({
      id: SystemWizardPageIds.pages,
      title: "Pages",
      summary: "Create and describe each page in your setup.",
      resolveStatus: (context) => toStatus(context.document.systemSpec.pages.every((page) => page.heading.trim().length > 0)),
      render: renderPagesPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.composition,
      title: "Compose",
      summary: "Pick and arrange system components.",
      resolveStatus: (context) => toStatus(context.document.systemSpec.components.length > 0),
      render: renderCompositionPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.interfaces,
      title: "Inputs & outputs",
      summary: "Define what goes in and what comes out.",
      resolveStatus: (context) => toStatus(
        context.document.systemSpec.inputs.length > 0 || context.document.systemSpec.outputs.length > 0,
      ),
      render: renderInterfacesPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.parameters,
      title: "Settings",
      summary: "Configure reusable system settings.",
      resolveStatus: (context) => toStatus(context.document.systemSpec.parameters.length > 0),
      render: renderParametersPage,
    }),
  ]),
  resolveProgress: ({ context, activePageId }) => {
    const pages = [
      {
        id: SystemWizardPageIds.pages,
        ready: context.document.systemSpec.pages.length > 0 && context.document.systemSpec.pages.every((page) => page.heading.trim().length > 0),
        title: "Pages",
      },
      { id: SystemWizardPageIds.composition, ready: context.document.systemSpec.components.length > 0, title: "Compose" },
      {
        id: SystemWizardPageIds.interfaces,
        ready: context.document.systemSpec.inputs.length > 0 || context.document.systemSpec.outputs.length > 0,
        title: "Inputs & outputs",
      },
      { id: SystemWizardPageIds.parameters, ready: context.document.systemSpec.parameters.length > 0, title: "Settings" },
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
      : context.document.systemSpec.pages.some((page) => page.heading.trim().length === 0)
        ? "Give each page a title so people know what each page is for."
        : context.document.systemSpec.components.length > 0
          ? "Your setup is ready. You can continue refining interfaces and settings."
          : "Next, add at least one component to make this setup work.",
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
    }),
  });
}
