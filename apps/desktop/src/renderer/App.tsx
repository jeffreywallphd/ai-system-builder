import { useState, type ReactNode } from "react";

import { AppShell } from "./components/layout/AppShell";
import { useDesktopPage } from "./hooks/useDesktopPage";
import { AssetLibraryPage } from "./pages/AssetLibraryPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { HomePage } from "./pages/HomePage";
import { ModelsPage } from "./pages/ModelsPage";
import { ImageGenerationPage } from "./pages/ImageGenerationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemPage } from "./pages/SystemPage";
import { ActiveWorkspaceProvider, WorkspaceGate, WorkspaceRequiredSurface, useActiveWorkspace, type WorkspaceUiRecord } from "./features/workspace";
import { desktopPageDefinitions, desktopPageRequiresWorkspace, type DesktopPageKey } from "./routes/desktopPages";
import { resolveDesktopWorkspaceRouteBoundary } from "./routes/workspaceRouteBoundary";

type DesktopWorkspacePageKey = Extract<DesktopPageKey, "artifacts" | "assets" | "models" | "image-generation">;

export function App() {
  return (
    <ActiveWorkspaceProvider>
      <WorkspaceAwareDesktopApp />
    </ActiveWorkspaceProvider>
  );
}

function WorkspaceAwareDesktopApp() {
  const { activePage, setActivePage } = useDesktopPage();
  const workspace = useActiveWorkspace();
  const [artifactRefreshToken, setArtifactRefreshToken] = useState(0);

  const activePageDefinition = desktopPageDefinitions.find((page) => page.key === activePage);
  const routeRequiresWorkspace = desktopPageRequiresWorkspace(activePage);
  const routeBoundary = resolveDesktopWorkspaceRouteBoundary(activePage, workspace.status);

  const renderWorkspacePageContent = (page: DesktopWorkspacePageKey, activeWorkspace: WorkspaceUiRecord): ReactNode => {
    switch (page) {
      case "artifacts":
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
      case "assets":
        return <AssetLibraryPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      case "models":
        return <ModelsPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      case "image-generation":
        return <ImageGenerationPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
    }
  };

  const renderGlobalPageContent = (page: DesktopPageKey): ReactNode => {
    switch (page) {
      case "home":
        return <HomePage onGoToArtifacts={() => setActivePage("artifacts")} />;
      case "settings":
        return <SettingsPage />;
      case "system":
        return <SystemPage />;
      default:
        return <WorkspaceRequiredSurface />;
    }
  };

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
      {content}
    </AppShell>
  );
}

export default App;
