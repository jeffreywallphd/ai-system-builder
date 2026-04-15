import type { ReactNode } from "react";

import type { DesktopPageKey } from "../../routes/desktopPage";

export interface AppShellProps {
  activePage: DesktopPageKey;
  onNavigate: (nextPage: DesktopPageKey) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <main>
      <h1>AI System Builder Desktop</h1>
      <nav aria-label="Primary">
        <button
          type="button"
          aria-current={activePage === "home" ? "page" : undefined}
          onClick={() => onNavigate("home")}
        >
          Home
        </button>
        <button
          type="button"
          aria-current={activePage === "system" ? "page" : undefined}
          onClick={() => onNavigate("system")}
        >
          System
        </button>
      </nav>
      {children}
    </main>
  );
}
