import type {
  ModelListItemViewModel,
  RemoteModelListItemViewModel,
} from "../../presenters/ModelPresenter";

export interface ModelCardProps {
  readonly model: ModelListItemViewModel | RemoteModelListItemViewModel;
  readonly isSelected?: boolean;
  readonly mode?: "installed" | "remote";
  readonly installProgressLabel?: string;
  readonly onSelect?: (modelId: string) => void;
  readonly onInstall?: (modelId: string) => void;
  readonly onRemove?: (modelId: string) => void;
  readonly onInspect?: (modelId: string) => void;
}

function isRemoteModel(
  model: ModelListItemViewModel | RemoteModelListItemViewModel
): model is RemoteModelListItemViewModel {
  return "provider" in model;
}

export default function ModelCard({
  model,
  isSelected,
  mode,
  installProgressLabel,
  onSelect,
  onInstall,
  onRemove,
  onInspect,
}: ModelCardProps): JSX.Element {
  const effectiveMode = mode ?? (isRemoteModel(model) ? "remote" : "installed");

  return (
    <article className={`ui-card ui-card--interactive${isSelected ? " ui-glow-accent" : ""}`}>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-row ui-row--between" style={{ alignItems: "flex-start" }}>
          <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
            <div className="ui-heading-4" style={{ overflowWrap: "anywhere" }}>
              {model.title}
            </div>
            {model.subtitle ? (
              <div className="ui-text-secondary ui-text-small">{model.subtitle}</div>
            ) : null}
          </div>

          <span
            className={`ui-badge ${
              model.isAvailable ? "ui-badge--success" : "ui-badge--warning"
            }`}
          >
            {model.status}
          </span>
        </div>

        <div className="ui-chips">
          <span className="ui-badge ui-badge--neutral">{model.kind}</span>
          {model.architectureFamily ? (
            <span className="ui-badge ui-badge--model">{model.architectureFamily}</span>
          ) : null}
          {isRemoteModel(model) ? (
            <span className="ui-badge ui-badge--info">{model.provider}</span>
          ) : null}
          {model.requiresAuth ? <span className="ui-badge ui-badge--warning">Auth</span> : null}
        </div>

        <div className="ui-row ui-row--wrap ui-subtle" style={{ fontSize: "var(--font-size-xs)" }}>
          {model.format ? <span>{model.format.toUpperCase()}</span> : null}
          {model.sizeLabel ? <span>{model.sizeLabel}</span> : null}
          {!model.isRunnable ? <span>Supporting asset</span> : null}
          {installProgressLabel ? <span>{installProgressLabel}</span> : null}
        </div>

        {model.taskBadges.length > 0 ? (
          <div className="ui-chips">
            {model.taskBadges.slice(0, 4).map((task) => (
              <span key={task} className="ui-badge ui-badge--neutral">
                {task}
              </span>
            ))}
          </div>
        ) : null}

        <div className="ui-row ui-row--wrap">
          <button
            className="ui-button ui-button--secondary ui-button--sm"
            type="button"
            onClick={() => onSelect?.(model.id)}
          >
            {isSelected ? "Selected" : "Select"}
          </button>

          <button
            className="ui-button ui-button--ghost ui-button--sm"
            type="button"
            onClick={() => onInspect?.(model.id)}
          >
            Inspect
          </button>

          {effectiveMode === "remote" && isRemoteModel(model) ? (
            <button
              className="ui-button ui-button--primary ui-button--sm"
              type="button"
              onClick={() => onInstall?.(model.remoteId ?? model.id)}
              disabled={!model.isInstallable}
            >
              {model.isInstallable ? "Install" : "Unavailable"}
            </button>
          ) : null}

          {effectiveMode === "installed" ? (
            <button
              className="ui-button ui-button--danger ui-button--sm"
              type="button"
              onClick={() => onRemove?.(model.id)}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
