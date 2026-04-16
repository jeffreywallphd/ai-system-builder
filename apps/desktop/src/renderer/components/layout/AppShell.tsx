import type { ReactNode } from "react";

import type { DesktopPageKey } from "../../routes/desktopPage";

export interface AppShellProps {
  activePage: DesktopPageKey;
  onNavigate: (nextPage: DesktopPageKey) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <main className="ui-shell">
      <div className="ui-container ui-shell__main">
        <header className="ui-shell__header">
          <h1 className="ui-shell__title">AI System Builder Desktop</h1>
          <nav className="ui-shell__nav" aria-label="Primary">
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
        </header>
        {children}
      </div>
    </main>
  );
}
