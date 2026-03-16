import type { NodePortViewModel } from "../../presenters/NodePresenter";

export interface NodePortProps {
  readonly port: NodePortViewModel;
  readonly side: "input" | "output";
}

export default function NodePort({
  port,
  side,
}: NodePortProps): JSX.Element {
  return (
    <div
      className={`ui-node-port ui-node-port--${side}`}
      title={`${port.name} (${port.valueTypes.join(", ") || "generic"})`}
    >
      {side === "output" ? null : <span className="ui-node-port__dot" aria-hidden="true" />}

      <div className="ui-node-port__content">
        <span className="ui-node-port__name">{port.name}</span>
        <div className="ui-chips">
          {port.valueTypes.slice(0, 2).map((type) => (
            <span key={`${port.id}-${type}`} className="ui-badge ui-badge--info">
              {type}
            </span>
          ))}
          {port.isOptional ? (
            <span className="ui-badge ui-badge--warning">Optional</span>
          ) : null}
          {port.isControlPort ? (
            <span className="ui-badge ui-badge--control">Control</span>
          ) : null}
        </div>
      </div>

      {side === "input" ? null : <span className="ui-node-port__dot" aria-hidden="true" />}
    </div>
  );
}
