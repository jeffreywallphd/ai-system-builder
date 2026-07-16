export interface SystemBuilderPageProps {
  readonly workspaceId: string;
  readonly workspaceName: string;
}

export function SystemBuilderPage({ workspaceName }: SystemBuilderPageProps) {
  return (
    <section className="ui-stack ui-stack--md" aria-labelledby="systems-title">
      <header className="ui-stack ui-stack--sm">
        <h1 id="systems-title">Systems</h1>
        <p className="ui-text-muted">Build systems in {workspaceName} by composing reusable assets, workflows, pages, tools, models, data, and subsystems.</p>
      </header>

      <section className="ui-panel ui-stack ui-stack--sm" aria-labelledby="system-builder-title">
        <h2 id="system-builder-title" className="ui-panel__title">System Builder</h2>
        <p>No composed systems are available yet. System creation and editing workflows will be added here through workspace-scoped contracts.</p>
        <p className="ui-text-muted">This preparation area does not start runtimes, execute workflows, or display builder-application status.</p>
      </section>

      <section className="ui-panel ui-stack ui-stack--sm" aria-labelledby="system-builder-foundation-title">
        <h2 id="system-builder-foundation-title" className="ui-panel__title">Prepared foundation</h2>
        <ul>
          <li>Systems specialize the existing Asset Kernel composition model.</li>
          <li>Every system record belongs to the active workspace.</li>
          <li>Composition validation remains separate from runtime readiness and execution.</li>
        </ul>
      </section>
    </section>
  );
}
