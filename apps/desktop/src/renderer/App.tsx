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
import { ActiveWorkspaceProvider, WorkspaceGate, useActiveWorkspace, type WorkspaceUiRecord } from "./features/workspace";
import { desktopPageDefinitions, desktopPageRequiresWorkspace, type DesktopPageKey } from "./routes/desktopPages";
import { resolveDesktopWorkspaceRouteBoundary } from "./routes/workspaceRouteBoundary";

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
  const { visibleActivePage } = resolveDesktopWorkspaceRouteBoundary(activePage, workspace.status);

  const renderDesktopPageContent = (page: DesktopPageKey, activeWorkspace?: WorkspaceUiRecord): ReactNode => {
    switch (page) {
      case "home":
        return <HomePage onGoToArtifacts={() => setActivePage("artifacts")} />;
      case "artifacts":
        return (
          <ArtifactsPage
            workspaceId={activeWorkspace?.id}
            workspaceName={activeWorkspace?.displayName}
            refreshToken={artifactRefreshToken}
            onUploaded={() => {
              setArtifactRefreshToken((current) => current + 1);
            }}
          />
        );
      case "assets":
        return <AssetLibraryPage workspaceId={activeWorkspace?.id} workspaceName={activeWorkspace?.displayName} />;
      case "models":
        return <ModelsPage workspaceId={activeWorkspace?.id} workspaceName={activeWorkspace?.displayName} />;
      case "image-generation":
        return <ImageGenerationPage workspaceId={activeWorkspace?.id} workspaceName={activeWorkspace?.displayName} />;
      case "settings":
        return <SettingsPage />;
      case "system":
        return <SystemPage />;
    }
  };

  const content = routeRequiresWorkspace ? (
    <WorkspaceGate pageLabel={activePageDefinition?.label ?? activePage}>
      {(activeWorkspace) => renderDesktopPageContent(activePage, activeWorkspace)}
    </WorkspaceGate>
  ) : renderDesktopPageContent(activePage);

  return (
    <AppShell
      activePage={visibleActivePage}
      onNavigate={setActivePage}
      pages={desktopPageDefinitions}
    >
      {content}
    </AppShell>
  );
}

export default App;
