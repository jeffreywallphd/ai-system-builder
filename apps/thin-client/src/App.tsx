import { useState } from "react";

import { AppShell } from "./components/layout/AppShell";
import { AssetLibraryPage } from "./pages/AssetLibraryPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { HomePage } from "./pages/HomePage";
import { ImageGenerationPage } from "./pages/ImageGenerationPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ActiveWorkspaceProvider, WorkspaceGate, type WorkspaceUiRecord } from "./features/workspace";
import { SecurityPage } from "./pages/SecurityPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  resolveThinClientPage,
  thinClientPageDefinitions,
  thinClientPageRequiresWorkspace,
  type ThinClientPageKey,
} from "./routes/thinClientPages";

function navigateToPage(page: ThinClientPageKey): void {
  const path = page === "artifacts" ? "/artifacts" : page === "assets" ? "/assets" : page === "image-generation" ? "/image-generation" : page === "models" ? "/models" : page === "security" ? "/security" : page === "settings" ? "/settings" : "/";
  window.history.pushState({}, "", path);
}

export function App() {
  const [activePage, setActivePage] = useState<ThinClientPageKey>(resolveThinClientPage(window.location.pathname));
  const renderContent = (workspace?: WorkspaceUiRecord) => {
    if (activePage === "artifacts") {
      return <ArtifactsPage workspaceId={workspace?.id} workspaceName={workspace?.displayName} />;
    }

    if (activePage === "image-generation") {
      return (
        <ImageGenerationPage
          workspaceId={workspace?.id}
          workspaceName={workspace?.displayName}
          onNavigateToArtifacts={() => { navigateToPage("artifacts"); setActivePage("artifacts"); }}
          onNavigateToModels={() => { navigateToPage("models"); setActivePage("models"); }}
        />
      );
    }

    if (activePage === "assets") {
      return <AssetLibraryPage workspaceId={workspace?.id} workspaceName={workspace?.displayName} />;
    }

    if (activePage === "models") {
      return <ModelsPage workspaceId={workspace?.id} workspaceName={workspace?.displayName} />;
    }

    if (activePage === "security") {
      return <SecurityPage />;
    }

    if (activePage === "settings") {
      return <SettingsPage />;
    }

    return <HomePage onGoToArtifacts={() => {
      navigateToPage("artifacts");
      setActivePage("artifacts");
    }} />;
  };

  const activePageDefinition = thinClientPageDefinitions.find((page) => page.key === activePage);
  const gatedContent = thinClientPageRequiresWorkspace(activePage) ? (
    <WorkspaceGate pageLabel={activePageDefinition?.label ?? activePage}>
      {(workspace) => renderContent(workspace)}
    </WorkspaceGate>
  ) : renderContent();

  return (
    <ActiveWorkspaceProvider>
    <AppShell
      activePage={activePage}
      pages={thinClientPageDefinitions}
      onNavigate={(nextPage) => {
        navigateToPage(nextPage);
        setActivePage(nextPage);
      }}
    >
      {gatedContent}
    </AppShell>
    </ActiveWorkspaceProvider>
  );
}

export default App;
