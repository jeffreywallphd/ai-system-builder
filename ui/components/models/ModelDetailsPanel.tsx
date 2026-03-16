import type { ModelDetailViewModel } from "../../presenters/ModelPresenter";

export interface ModelDetailsPanelProps {
  readonly model?: ModelDetailViewModel;
  readonly title?: string;
  readonly emptyMessage?: string;
}

export default function ModelDetailsPanel({
  model,
  title = "Model Details",
  emptyMessage = "Select a model to inspect details.",
}: ModelDetailsPanelProps): JSX.Element {
  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">{title}</div>
          <div className="ui-panel__subtitle">
            Metadata, compatibility, and artifact information.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        {!model ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--md">
            <div className="ui-stack ui-stack--sm">
              <div className="ui-stack ui-stack--2xs">
                <div className="ui-heading-4">{model.name}</div>
                {model.description ? <p className="ui-text-secondary">{model.description}</p> : null}
              </div>

              <div className="ui-chips">
                <span className="ui-badge ui-badge--neutral">{model.kindLabel}</span>
                <span className="ui-badge ui-badge--info">{model.statusLabel}</span>
                {model.architectureFamily ? (
                  <span className="ui-badge ui-badge--model">{model.architectureFamily}</span>
                ) : null}
                {model.requiresAuth ? (
                  <span className="ui-badge ui-badge--warning">Auth Required</span>
                ) : null}
              </div>
            </div>

            <div className="ui-divider" />

            <div className="ui-meta-grid">
              <div className="ui-meta-item">
                <div className="ui-meta-label">Publisher</div>
                <div className="ui-meta-value">{model.publisher ?? "—"}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Reference</div>
                <div className="ui-meta-value">{model.reference}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Artifact Format</div>
                <div className="ui-meta-value">{model.artifact.format || "Unknown"}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Artifact Size</div>
                <div className="ui-meta-value">{model.sizeLabel ?? "Unknown"}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Availability</div>
                <div className="ui-meta-value">{model.availableLabel}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Artifact Location</div>
                <div className="ui-meta-value">{model.artifact.location ?? "—"}</div>
              </div>
            </div>

            <div className="ui-divider" />

            <div className="ui-stack ui-stack--sm">
              <div className="ui-heading-4">Tasks</div>
              <div className="ui-chips">
                {model.compatibility.supportedTasks.length > 0 ? (
                  model.compatibility.supportedTasks.map((task) => (
                    <span key={task} className="ui-badge ui-badge--neutral">
                      {task}
                    </span>
                  ))
                ) : (
                  <span className="ui-subtle">No explicit tasks</span>
                )}
              </div>
            </div>

            <div className="ui-stack ui-stack--sm">
              <div className="ui-heading-4">Runtimes</div>
              <div className="ui-chips">
                {model.compatibility.supportedRuntimes.length > 0 ? (
                  model.compatibility.supportedRuntimes.map((runtime) => (
                    <span key={runtime} className="ui-badge ui-badge--info">
                      {runtime}
                    </span>
                  ))
                ) : (
                  <span className="ui-subtle">No explicit runtimes</span>
                )}
              </div>
            </div>

            {model.tags.length > 0 ? (
              <div className="ui-stack ui-stack--sm">
                <div className="ui-heading-4">Tags</div>
                <div className="ui-chips">
                  {model.tags.map((tag) => (
                    <span key={tag} className="ui-badge ui-badge--neutral">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
