import type { ReactNode } from "react";

import { AppShell } from "./components/layout/AppShell";
import { useDesktopPage } from "./hooks/useDesktopPage";
import { HomePage } from "./pages/HomePage";
import { SystemPage } from "./pages/SystemPage";
import { desktopPageDefinitions, type DesktopPageKey } from "./routes/desktopPages";

const desktopPageContentMap: Record<DesktopPageKey, ReactNode> = {
  home: <HomePage />,
  system: <SystemPage />,
};

export function App() {
  const { activePage, setActivePage } = useDesktopPage();

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      pages={desktopPageDefinitions}
    >
      {desktopPageContentMap[activePage]}
    </AppShell>
  );
}

export default App;
