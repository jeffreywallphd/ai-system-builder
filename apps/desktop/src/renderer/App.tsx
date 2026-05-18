import { Suspense, useEffect, useState, type ReactNode } from "react";

import { AppShell } from "./components/layout/AppShell";
import { DesktopPageLoadingFallback } from "./components/layout/DesktopPageLoadingFallback";
import { useDesktopPage } from "./hooks/useDesktopPage";
import { ActiveWorkspaceProvider, WorkspaceGate, WorkspaceRequiredSurface, useActiveWorkspace, type WorkspaceUiRecord } from "./features/workspace";
import { desktopPageDefinitions, desktopPageRequiresWorkspace, type DesktopPageKey } from "./routes/desktopPages";
import { desktopLazyPages, setDesktopLazyPageDiagnosticContext, type DesktopLazyPageRegistry } from "./routes/lazyDesktopPages";
import { resolveDesktopWorkspaceRouteBoundary } from "./routes/workspaceRouteBoundary";
import { recordRendererMemorySnapshot } from "./diagnostics/rendererMemoryDiagnostics";

type DesktopWorkspacePageKey = Extract<DesktopPageKey, "artifacts" | "assets" | "models" | "image-generation">;

export function App() {
  useEffect(() => {
    recordRendererMemorySnapshot({
      milestone: "renderer.app.mounted",
      component: "desktop-renderer",
    });
  }, []);

  return (
    <ActiveWorkspaceProvider>
      <WorkspaceAwareDesktopApp />
    </ActiveWorkspaceProvider>
  );
}

export interface WorkspaceAwareDesktopAppProps {
  readonly lazyPages?: DesktopLazyPageRegistry;
}

export function WorkspaceAwareDesktopApp({ lazyPages = desktopLazyPages }: WorkspaceAwareDesktopAppProps = {}) {
  const { activePage, setActivePage } = useDesktopPage();
  const workspace = useActiveWorkspace();
  const [artifactRefreshToken, setArtifactRefreshToken] = useState(0);

  const activePageDefinition = desktopPageDefinitions.find((page) => page.key === activePage);
  const routeRequiresWorkspace = desktopPageRequiresWorkspace(activePage);
  const routeBoundary = resolveDesktopWorkspaceRouteBoundary(activePage, workspace.status);
  setDesktopLazyPageDiagnosticContext({
    activePage,
    visibleActivePage: routeBoundary.visibleActivePage,
    workspaceStatus: workspace.status,
    routeRequiresWorkspace,
  });

  const lazyPageFallback = (
    <DesktopPageLoadingFallback
      activePage={activePage}
      visibleActivePage={routeBoundary.visibleActivePage}
      workspaceStatus={workspace.status}
      routeRequiresWorkspace={routeRequiresWorkspace}
    />
  );

  const renderWorkspacePageContent = (page: DesktopWorkspacePageKey, activeWorkspace: WorkspaceUiRecord): ReactNode => {
    switch (page) {
      case "artifacts": {
        const ArtifactsPage = lazyPages.artifacts;
        return (
          <ArtifactsPage
            workspaceId={activeWorkspace.id}
            workspaceName={activeWorkspace.displayName}
            refreshToken={artifactRefreshToken}
            onUploaded={() => {
              setArtifactRefreshToken((current) => current + 1);
            }}
          />
        );
      }
      case "assets": {
        const AssetLibraryPage = lazyPages.assets;
        return <AssetLibraryPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      }
      case "models": {
        const ModelsPage = lazyPages.models;
        return <ModelsPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      }
      case "image-generation": {
        const ImageGenerationPage = lazyPages["image-generation"];
        return <ImageGenerationPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      }
    }
  };

  const renderGlobalPageContent = (page: DesktopPageKey): ReactNode => {
    switch (page) {
      case "home": {
        const HomePage = lazyPages.home;
        return <HomePage onGoToArtifacts={() => setActivePage("artifacts")} />;
      }
      case "settings": {
        const SettingsPage = lazyPages.settings;
        return <SettingsPage />;
      }
      case "system": {
        const SystemPage = lazyPages.system;
        return <SystemPage />;
      }
      default:
        return <WorkspaceRequiredSurface />;
    }
  };

  useEffect(() => {
    recordRendererMemorySnapshot({
      milestone: "renderer.page.active.changed",
      component: "desktop-renderer",
      detail: {
        activePage,
        visibleActivePage: routeBoundary.visibleActivePage,
        workspaceStatus: workspace.status,
      },
    });
  }, [activePage, routeBoundary.visibleActivePage, workspace.status]);

  const content = routeBoundary.blocked ? (
    <WorkspaceRequiredSurface />
  ) : routeRequiresWorkspace ? (
    <WorkspaceGate pageLabel={activePageDefinition?.label ?? activePage}>
      {(activeWorkspace) => renderWorkspacePageContent(activePage as DesktopWorkspacePageKey, activeWorkspace)}
    </WorkspaceGate>
  ) : renderGlobalPageContent(activePage);

  return (
    <AppShell
      activePage={routeBoundary.visibleActivePage}
      onNavigate={setActivePage}
      pages={desktopPageDefinitions}
    >
      <Suspense fallback={lazyPageFallback}>{content}</Suspense>
    </AppShell>
  );
}

export default App;
