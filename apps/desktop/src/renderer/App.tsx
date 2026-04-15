import { AppShell } from "./components/layout/AppShell";
import { useDesktopPage } from "./hooks/useDesktopPage";
import type { DesktopImageUploadApi } from "./lib/desktopApi";
import { HomePage } from "./pages/HomePage";
import { SystemPage } from "./pages/SystemPage";

export interface AppProps {
  uploadApi?: DesktopImageUploadApi;
}

export function App({ uploadApi }: AppProps) {
  const { activePage, setActivePage } = useDesktopPage();

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {activePage === "home" ? <HomePage uploadApi={uploadApi} /> : <SystemPage />}
    </AppShell>
  );
}

export default App;
