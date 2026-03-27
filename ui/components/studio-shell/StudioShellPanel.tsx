import type { ReactNode } from "react";

export interface StudioShellPanelProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
}

export function StudioShellPanel({ title, subtitle, children }: StudioShellPanelProps): JSX.Element {
  return (
    <section className="ui-card ui-stack ui-stack--sm">
      <header className="ui-stack ui-stack--2xs">
        <h3 className="ui-heading-3">{title}</h3>
        {subtitle ? <p className="ui-text-muted">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
