import type { ReactNode } from "react";

import type { ThinClientPageDefinition, ThinClientPageKey } from "../../routes/thinClientPages";

export interface AppShellProps {
  activePage: ThinClientPageKey;
  pages: readonly ThinClientPageDefinition[];
  onNavigate: (nextPage: ThinClientPageKey) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, pages, children }: AppShellProps) {
  return (
    <main className="ui-shell">
      <div className="ui-container ui-stack ui-stack--md">
        <header className="ui-panel ui-stack ui-stack--xs">
          <h1>AI System Builder Thin Client</h1>
          <p className="ui-text-muted">
            Server-backed host surface using feature-local HTTP API clients.
          </p>
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
