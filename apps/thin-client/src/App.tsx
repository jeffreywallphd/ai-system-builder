import { useState, type ReactNode } from "react";

import { AppShell } from "./components/layout/AppShell";
import { AssetLibraryPage } from "./pages/AssetLibraryPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { HomePage } from "./pages/HomePage";
import { ImageGenerationPage } from "./pages/ImageGenerationPage";
import { ModelsPage } from "./pages/ModelsPage";
import { UserLibraryPage } from "./pages/UserLibraryPage";
import { ActiveWorkspaceProvider, WorkspaceGate, WorkspaceRequiredSurface, useActiveWorkspace, type WorkspaceUiRecord } from "./features/workspace";
import { SecurityPage } from "./pages/SecurityPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  resolveThinClientPage,
  thinClientPageDefinitions,
  thinClientPageRequiresWorkspace,
  type ThinClientPageKey,
} from "./routes/thinClientPages";
import { resolveThinClientWorkspaceRouteBoundary } from "./routes/workspaceRouteBoundary";

type ThinClientWorkspacePageKey = Extract<ThinClientPageKey, "artifacts" | "assets" | "user-library" | "models" | "image-generation">;

function navigateToPage(page: ThinClientPageKey): void {
  const path = page === "artifacts" ? "/artifacts" : page === "assets" ? "/assets" : page === "user-library" ? "/user-library" : page === "image-generation" ? "/image-generation" : page === "models" ? "/models" : page === "security" ? "/security" : page === "settings" ? "/settings" : "/";
  window.history.pushState({}, "", path);
}

export function App() {
  return (
    <ActiveWorkspaceProvider>
      <WorkspaceAwareThinClientApp />
    </ActiveWorkspaceProvider>
  );
}

function WorkspaceAwareThinClientApp() {
  const [activePage, setActivePage] = useState<ThinClientPageKey>(resolveThinClientPage(window.location.pathname));
  const workspace = useActiveWorkspace();
  const activePageDefinition = thinClientPageDefinitions.find((page) => page.key === activePage);
  const routeRequiresWorkspace = thinClientPageRequiresWorkspace(activePage);
  const routeBoundary = resolveThinClientWorkspaceRouteBoundary(activePage, workspace.status);

  const setRoute = (nextPage: ThinClientPageKey) => {
    navigateToPage(nextPage);
    setActivePage(nextPage);
  };

  const renderWorkspacePageContent = (page: ThinClientWorkspacePageKey, activeWorkspace: WorkspaceUiRecord): ReactNode => {
    switch (page) {
      case "artifacts":
        return <ArtifactsPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      case "image-generation":
        return (
          <ImageGenerationPage
            workspaceId={activeWorkspace.id}
            workspaceName={activeWorkspace.displayName}
            onNavigateToArtifacts={() => setRoute("artifacts")}
            onNavigateToModels={() => setRoute("models")}
          />
        );
      case "assets":
        return <AssetLibraryPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      case "user-library":
        return <UserLibraryPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
      case "models":
        return <ModelsPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.displayName} />;
    }
  };

  const renderGlobalPageContent = (page: ThinClientPageKey): ReactNode => {
    switch (page) {
      case "security":
        return <SecurityPage />;
      case "settings":
        return <SettingsPage />;
      case "home":
        return <HomePage onGoToArtifacts={() => setRoute("artifacts")} />;
      default:
        return <WorkspaceRequiredSurface />;
    }
  };

  const content = routeBoundary.blocked ? (
    <WorkspaceRequiredSurface />
  ) : routeRequiresWorkspace ? (
    <WorkspaceGate pageLabel={activePageDefinition?.label ?? activePage}>
      {(activeWorkspace) => renderWorkspacePageContent(activePage as ThinClientWorkspacePageKey, activeWorkspace)}
    </WorkspaceGate>
  ) : renderGlobalPageContent(activePage);

  return (
    <AppShell
      activePage={routeBoundary.visibleActivePage}
      pages={thinClientPageDefinitions}
      onNavigate={setRoute}
    >
      {content}
    </AppShell>
  );
}

export default App;
