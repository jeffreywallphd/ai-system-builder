import { useMemo, useState } from "react";

import { AppShell } from "./components/layout/AppShell";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { HomePage } from "./pages/HomePage";
import { ImageGenerationPage } from "./pages/ImageGenerationPage";
import { ModelsPage } from "./pages/ModelsPage";
import {
  resolveThinClientPage,
  thinClientPageDefinitions,
  type ThinClientPageKey,
} from "./routes/thinClientPages";

function navigateToPage(page: ThinClientPageKey): void {
  const path = page === "artifacts" ? "/artifacts" : page === "image-generation" ? "/image-generation" : page === "models" ? "/models" : "/";
  window.history.pushState({}, "", path);
}

export function App() {
  const [activePage, setActivePage] = useState<ThinClientPageKey>(resolveThinClientPage(window.location.pathname));
  const [artifactRefreshToken, setArtifactRefreshToken] = useState(0);

  const content = useMemo(() => {
    if (activePage === "artifacts") {
      return (
        <ArtifactsPage
          refreshToken={artifactRefreshToken}
          onUploaded={() => setArtifactRefreshToken((current) => current + 1)}
        />
      );
    }

    if (activePage === "image-generation") {
      return (
        <ImageGenerationPage
          onGenerated={() => setArtifactRefreshToken((current) => current + 1)}
          onNavigateToArtifacts={() => { navigateToPage("artifacts"); setActivePage("artifacts"); }}
          onNavigateToModels={() => { navigateToPage("models"); setActivePage("models"); }}
        />
      );
    }

    if (activePage === "models") {
      return <ModelsPage />;
      return <ImageGenerationPage />;
    }

    return <HomePage onGoToArtifacts={() => {
      navigateToPage("artifacts");
      setActivePage("artifacts");
    }} />;
  }, [activePage, artifactRefreshToken]);

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
