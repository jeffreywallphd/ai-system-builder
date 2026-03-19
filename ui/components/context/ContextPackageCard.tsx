import type { IContextPackageSummary } from "../../../application/ports/interfaces/IContextPackageRepository";

export interface ContextPackageCardProps {
  readonly contextPackage: IContextPackageSummary;
  readonly isSelected?: boolean;
  readonly onSelect?: (contextPackageId: string) => void;
}

export default function ContextPackageCard({
  contextPackage,
  isSelected = false,
  onSelect,
}: ContextPackageCardProps): JSX.Element {
  return (
    <button
      type="button"
      className={`ui-card ui-context-card${isSelected ? " ui-context-card--selected" : ""}`}
      onClick={() => onSelect?.(contextPackage.id)}
    >
      <div className="ui-context-card__header">
        <div>
          <h3 className="ui-context-card__title">{contextPackage.name}</h3>
          <p className="ui-context-card__id">{contextPackage.id}</p>
        </div>
        <span className="ui-badge ui-badge--neutral">{contextPackage.fragmentCount} fragments</span>
      </div>

      {contextPackage.description ? (
        <p className="ui-context-card__description">{contextPackage.description}</p>
      ) : (
        <p className="ui-context-card__description ui-subtle">No description yet.</p>
      )}

      <div className="ui-context-card__meta">
        <div className="ui-chips">
          {contextPackage.tags.length > 0 ? (
            contextPackage.tags.map((tag) => (
              <span key={tag} className="ui-badge ui-badge--neutral">
                #{tag}
              </span>
            ))
          ) : (
            <span className="ui-subtle">No tags</span>
          )}
        </div>
        <span className="ui-subtle ui-text-small">
          Updated {contextPackage.updatedAt ? contextPackage.updatedAt.toLocaleDateString() : "just now"}
        </span>
      </div>
    </button>
  );
}
