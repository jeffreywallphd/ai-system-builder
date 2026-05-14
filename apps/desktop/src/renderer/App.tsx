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
import { ActiveWorkspaceProvider, WorkspaceGate, type WorkspaceUiRecord } from "./features/workspace";
import { desktopPageDefinitions, desktopPageRequiresWorkspace, type DesktopPageKey } from "./routes/desktopPages";

export function App() {
  const { activePage, setActivePage } = useDesktopPage();
  const [artifactRefreshToken, setArtifactRefreshToken] = useState(0);

  const renderDesktopPageContent = (workspace?: WorkspaceUiRecord): Record<DesktopPageKey, ReactNode> => ({
    home: <HomePage onGoToArtifacts={() => setActivePage("artifacts")} />,
    artifacts: (
      <ArtifactsPage
        workspaceId={workspace?.id}
        workspaceName={workspace?.displayName}
        refreshToken={artifactRefreshToken}
        onUploaded={() => {
          setArtifactRefreshToken((current) => current + 1);
        }}
      />
    ),
    assets: <AssetLibraryPage workspaceId={workspace?.id} workspaceName={workspace?.displayName} />,
    models: <ModelsPage workspaceId={workspace?.id} workspaceName={workspace?.displayName} />,
    "image-generation": <ImageGenerationPage workspaceId={workspace?.id} workspaceName={workspace?.displayName} />,
    settings: <SettingsPage />,
    system: <SystemPage />,
  });

  const activePageDefinition = desktopPageDefinitions.find((page) => page.key === activePage);
  const content = desktopPageRequiresWorkspace(activePage) ? (
    <WorkspaceGate pageLabel={activePageDefinition?.label ?? activePage}>
      {(workspace) => renderDesktopPageContent(workspace)[activePage]}
    </WorkspaceGate>
  ) : renderDesktopPageContent()[activePage];

  return (
    <ActiveWorkspaceProvider>
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      pages={desktopPageDefinitions}
    >
      {content}
    </AppShell>
    </ActiveWorkspaceProvider>
  );
}

export default App;
