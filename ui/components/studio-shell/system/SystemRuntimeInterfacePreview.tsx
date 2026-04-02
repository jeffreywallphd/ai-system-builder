import { useMemo, useState } from "react";
import { mapPanelAssetToRuntimeInstance } from "../../../studio-shell/experience-assets/PanelAssetContracts";
import { parseSystemStudioDraftDocument } from "../../../studio-shell/system/SystemStudioDraftDocument";
import type { StudioShellExtensionContext } from "../../../studio-shell/StudioShellExtensions";
import type { StudioAssetDefinition } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import { StudioAssetRenderModes } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import type { StudioEmbeddedEvent } from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";
import { createStudioHostContext, createStudioHostSessionState } from "../../../studio-shell/studio-assets/StudioSurfaceAssetDefinitions";
import StudioAssetHostBoundary from "../studio-assets/StudioAssetHostBoundary";

interface SystemRuntimeInterfacePreviewProps {
  readonly content: string;
  readonly extensionContext?: StudioShellExtensionContext;
  readonly studioAssetHosts?: Readonly<Record<string, RuntimePanelStudioAssetHost>>;
}

interface RuntimePanelStudioAssetHost {
  readonly asset: StudioAssetDefinition<unknown, StudioEmbeddedEvent>;
  readonly resolveInput: (params: {
    readonly panel: ReturnType<typeof mapPanelAssetToRuntimeInstance>;
    readonly content: string;
    readonly extensionContext: StudioShellExtensionContext;
  }) => unknown;
}

interface RuntimePageLayoutModel {
  readonly pageId: string;
  readonly title: string;
  readonly description?: string;
  readonly panels: ReturnType<typeof mapPanelAssetToRuntimeInstance>[];
}

function resolveRuntimePages(content: string): {
  readonly pages: ReadonlyArray<RuntimePageLayoutModel>;
  readonly defaultLandingPageId?: string;
} {
  const document = parseSystemStudioDraftDocument(content);
  return Object.freeze({
    pages: Object.freeze(document.systemSpec.pages.map((page) => {
    const layout = document.canvasAuthoring.pageLayouts.find((entry) => entry.pageId === page.pageId);
    return Object.freeze({
      pageId: page.pageId,
      title: page.title,
      description: page.description,
      panels: Object.freeze((layout?.panels ?? []).map((panel) => mapPanelAssetToRuntimeInstance(panel))),
    });
    })),
    defaultLandingPageId: document.systemSpec.settings.defaultLandingPageId,
  });
}

export default function SystemRuntimeInterfacePreview({
  content,
  extensionContext,
  studioAssetHosts,
}: SystemRuntimeInterfacePreviewProps): JSX.Element {
  const { pages, defaultLandingPageId } = useMemo(() => resolveRuntimePages(content), [content]);
  const [selectedPageId, setSelectedPageId] = useState<string>(defaultLandingPageId ?? pages[0]?.pageId ?? "page-1");
  const activePage = pages.find((page) => page.pageId === selectedPageId) ?? pages[0];

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-runtime-interface-preview">
      <div className="ui-stack ui-stack--2xs">
        <strong>Interface preview</strong>
        <p className="ui-text-small ui-text-secondary">
          This preview uses your saved page and panel layout so you can confirm the live experience flow.
        </p>
      </div>

      {pages.length > 1 ? (
        <div className="ui-row ui-row--wrap" data-testid="system-runtime-interface-pages">
          {pages.map((page) => (
            <button
              key={page.pageId}
              type="button"
              className={`ui-button ui-button--sm ${page.pageId === activePage?.pageId ? "ui-button--primary" : "ui-button--ghost"}`}
              onClick={() => setSelectedPageId(page.pageId)}
            >
              {page.title}
            </button>
          ))}
        </div>
      ) : null}

      {activePage ? (
        <article className="ui-card ui-card--padded ui-stack ui-stack--xs">
          <header className="ui-stack ui-stack--3xs">
            <strong>{activePage.title}</strong>
            {activePage.description ? <span className="ui-text-small ui-text-secondary">{activePage.description}</span> : null}
          </header>
          {activePage.panels.length > 0 ? (
            <div className="ui-system-runtime-layout-frame" data-testid="system-runtime-interface-layout">
              {activePage.panels.map((panel) => (
                <section
                  key={panel.instanceId}
                  className="ui-system-runtime-layout-panel ui-card ui-card--padded ui-stack ui-stack--3xs"
                  style={{
                    left: `${panel.layoutBounds.x * 100}%`,
                    top: `${panel.layoutBounds.y * 100}%`,
                    width: `${panel.layoutBounds.width * 100}%`,
                    height: `${panel.layoutBounds.height * 100}%`,
                  }}
                  data-testid={`system-runtime-interface-panel-${panel.panelId}`}
                >
                  <strong>{panel.title}</strong>
                  {panel.content?.kind === "embedded-studio" && extensionContext && studioAssetHosts?.[panel.content.studioAssetId] ? (
                    <StudioAssetHostBoundary
                      asset={studioAssetHosts[panel.content.studioAssetId].asset}
                      context={createStudioHostContext({
                        hostId: `runtime-panel-${panel.instanceId}`,
                        mode: StudioAssetRenderModes.embedded,
                        capabilities: Object.freeze({
                          canNavigate: false,
                          canShowShellChrome: false,
                          canMutateDraft: false,
                          canLaunchRuns: false,
                          canManageSessionState: false,
                        }),
                        input: studioAssetHosts[panel.content.studioAssetId].resolveInput({
                          panel,
                          content,
                          extensionContext,
                        }),
                      })}
                      session={createStudioHostSessionState({
                        sessionId: extensionContext.snapshot?.activeSessionId,
                        draftId: extensionContext.snapshot?.draft?.draftId,
                        isBusy: extensionContext.isBusy,
                        operationError: extensionContext.operationError,
                      })}
                    />
                  ) : (
                    <span className="ui-text-small ui-text-secondary">
                      {panel.description ?? "No content has been connected yet."}
                    </span>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="ui-card ui-card--padded" data-testid="system-runtime-interface-empty-panel-state">
              <strong>This page is ready for content</strong>
              <p className="ui-text-small ui-text-secondary">
                Add panels in Interface Design to build this page.
              </p>
            </div>
          )}
        </article>
      ) : null}
    </section>
  );
}
