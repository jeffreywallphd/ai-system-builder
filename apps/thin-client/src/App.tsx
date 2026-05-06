import { useMemo, useState } from "react";

import { AppShell } from "./components/layout/AppShell";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { HomePage } from "./pages/HomePage";
import { ImageGenerationPage } from "./pages/ImageGenerationPage";
import { ModelsPage } from "./pages/ModelsPage";
import { SecurityPage } from "./pages/SecurityPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  resolveThinClientPage,
  thinClientPageDefinitions,
  type ThinClientPageKey,
} from "./routes/thinClientPages";

function navigateToPage(page: ThinClientPageKey): void {
  const path = page === "artifacts" ? "/artifacts" : page === "image-generation" ? "/image-generation" : page === "models" ? "/models" : page === "security" ? "/security" : page === "settings" ? "/settings" : "/";
  window.history.pushState({}, "", path);
}

export function App() {
  const [activePage, setActivePage] = useState<ThinClientPageKey>(resolveThinClientPage(window.location.pathname));
  const content = useMemo(() => {
    if (activePage === "artifacts") {
      return <ArtifactsPage />;
    }

    if (activePage === "image-generation") {
      return (
        <ImageGenerationPage
          onNavigateToArtifacts={() => { navigateToPage("artifacts"); setActivePage("artifacts"); }}
          onNavigateToModels={() => { navigateToPage("models"); setActivePage("models"); }}
        />
      );
    }

    if (activePage === "models") {
      return <ModelsPage />;
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
  }, [activePage]);

  return (
    <AppShell
      activePage={activePage}
      pages={thinClientPageDefinitions}
      onNavigate={(nextPage) => {
        navigateToPage(nextPage);
        setActivePage(nextPage);
      }}
    >
      {content}
    </AppShell>
  );
}

export default App;
