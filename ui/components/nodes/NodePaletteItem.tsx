import { useState } from "react";
import type { NodePaletteItemViewModel } from "../../presenters/NodePresenter";

export interface NodePaletteItemProps {
  readonly item: NodePaletteItemViewModel;
  readonly isSelected?: boolean;
  readonly onSelect?: (definitionId: string) => void;
  readonly onAdd?: (definitionId: string) => void;
}

export default function NodePaletteItem({
  item,
  isSelected,
  onSelect,
  onAdd,
}: NodePaletteItemProps): JSX.Element {
  const [arePropertiesExpanded, setArePropertiesExpanded] = useState(false);

  return (
    <article className={`ui-card ui-card--interactive${isSelected ? " ui-glow-accent" : ""}`}>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <div className="ui-row ui-row--between" style={{ alignItems: "flex-start" }}>
          <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
            <div className="ui-heading-4" style={{ overflowWrap: "anywhere" }}>
              {item.title}
            </div>
            {item.description ? (
              <div className="ui-text-secondary ui-text-small">{item.description}</div>
            ) : null}
          </div>

          <span className="ui-badge ui-badge--neutral">{item.category}</span>
        </div>

        <div className="ui-chips">
          <span className="ui-badge ui-badge--neutral">{item.executionKind}</span>
          {item.isModelAware ? <span className="ui-badge ui-badge--model">Model Aware</span> : null}
          {item.isVisibleInBasicMode ? (
            <span className="ui-badge ui-badge--success">Basic</span>
          ) : (
            <span className="ui-badge ui-badge--warning">Advanced</span>
          )}
        </div>

        <div className="ui-row ui-row--wrap">
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => onSelect?.(item.id)}
          >
            {isSelected ? "Selected" : "Select"}
          </button>

          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            onClick={() => onAdd?.(item.id)}
          >
            Add Node
          </button>
        </div>

        {item.properties.length > 0 ? (
          <div className="ui-expandable-section">
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => setArePropertiesExpanded((value) => !value)}
            >
              {arePropertiesExpanded ? "Hide Properties" : `Show Properties (${item.properties.length})`}
            </button>

            {arePropertiesExpanded ? (
              <ul className="ui-expandable-section__list ui-text-small" aria-label="Node properties summary">
                {item.properties.map((property) => (
                  <li key={property.id} className="ui-expandable-section__item">
                    <span>{property.name}</span>
                    <span className="ui-text-secondary">{property.type}</span>
                    {property.isRequired ? <span className="ui-badge ui-badge--danger">Required</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
