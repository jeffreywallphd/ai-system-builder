import type { JSX } from "react";
import ConfigurableCanvasSurface from "../../components/studio-shell/experience-assets/ConfigurableCanvasSurface";
import type { StudioShellValidationIssue } from "../../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { CanvasExperienceAssetDefinition } from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type { WizardExperienceAssetDefinition } from "../experience-assets/ConfigurableWizardSurfaceContracts";
import type { StudioShellExtensionContext } from "../StudioShellExtensions";
import { parseSystemStudioDraftDocument, type SystemStudioDraftDocument } from "./SystemStudioDraftDocument";
import { SystemPageSetupEditor } from "../../components/studio-shell/system/SystemPageSetupEditor";
import { SystemSettingsEditor } from "../../components/studio-shell/system/SystemSettingsEditor";
import type { SystemCanvasExperienceContext } from "./SystemCanvasExperienceAdapter";

export const SystemWizardPageIds = Object.freeze({
  pages: "pages",
  interfaceDesign: "interface-design",
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

function renderSettingsPage(context: SystemWizardExperienceContext): JSX.Element {
  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-wizard-settings-page">
      <SystemSettingsEditor context={context.extensionContext} />
    </section>
  );
}

const definition: WizardExperienceAssetDefinition<SystemWizardExperienceContext> = Object.freeze({
  id: "system-authoring-wizard",
  title: "System authoring wizard",
  summary: "Guided setup flow for system assets.",
  // System Studio intentionally stays scoped to page structure + navigation/settings.
  // Panel internals and specialized behavior/data authoring are handled in dedicated studios.
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
      title: "Page layout",
      summary: "Arrange each page in the design canvas.",
      resolveStatus: (context) => toStatus(resolveInterfaceDesignReadiness(context.document)),
      render: renderInterfaceDesignPage,
    }),
    Object.freeze({
      id: SystemWizardPageIds.settings,
      title: "Settings",
      summary: "Manage navigation and system-wide defaults.",
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
        title: "Page layout",
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
          : "Your setup is ready. You can keep refining page structure, navigation, and settings.",
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
    }),
  });
}
