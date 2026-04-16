import type { ReactNode } from "react";

import type { DesktopPageDefinition, DesktopPageKey } from "../../routes/desktopPages";

export interface AppShellProps {
  activePage: DesktopPageKey;
  onNavigate: (nextPage: DesktopPageKey) => void;
  pages: readonly DesktopPageDefinition[];
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, pages, children }: AppShellProps) {
  return (
    <main className="ui-shell">
      <div className="ui-container ui-shell__main">
        <header className="ui-shell__header">
          <h1 className="ui-shell__title">AI System Builder Desktop</h1>
          <nav className="ui-shell__nav" aria-label="Primary">
            {pages.map((page) => (
              <button
                key={page.key}
                className="ui-button"
                type="button"
                aria-current={activePage === page.key ? "page" : undefined}
                onClick={() => onNavigate(page.key)}
              >
                {page.label}
              </button>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
