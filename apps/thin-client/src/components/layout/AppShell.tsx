import type { ReactNode } from "react";

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="ui-shell">
      <div className="ui-container ui-stack ui-stack--md">
        <header className="ui-panel ui-stack ui-stack--xs">
          <h1>AI System Builder Thin Client</h1>
          <p className="ui-text-muted">
            Server-backed host surface using feature-local HTTP API clients.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}
