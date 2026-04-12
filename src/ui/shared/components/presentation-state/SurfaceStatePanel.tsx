import type { ReactNode } from "react";
import { SurfaceEmptyState, SurfaceStatusRegion } from "../shell/SurfaceShellPrimitives";
import type { SurfacePresentationState } from "./SurfacePresentationState";

export interface SurfaceStatePanelProps {
  readonly state: SurfacePresentationState;
  readonly action?: ReactNode;
}

export function SurfaceStatePanel({ state, action }: SurfaceStatePanelProps): JSX.Element {
  if (state.kind === "empty" || state.kind === "not-found" || state.kind === "permission-denied") {
    return (
      <SurfaceEmptyState
        title={state.title}
        message={state.message}
        action={action}
      />
    );
  }

  const tone = state.kind === "error"
    ? "danger"
    : state.kind === "disconnected"
      ? "warning"
      : "neutral";

  return (
    <SurfaceStatusRegion tone={tone} className={`ui-surface-state ui-surface-state--${state.kind}`}>
      <h3 className="ui-surface-state__title">{state.title}</h3>
      <p className="ui-surface-state__message">{state.message}</p>
      {state.details ? <p className="ui-surface-state__details">{state.details}</p> : null}
      {action ? <div className="ui-surface-state__actions">{action}</div> : null}
    </SurfaceStatusRegion>
  );
}

export interface SurfaceStateBoundaryProps {
  readonly state?: SurfacePresentationState;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

export function SurfaceStateBoundary({ state, action, children }: SurfaceStateBoundaryProps): JSX.Element {
  if (state) {
    return <SurfaceStatePanel state={state} action={action} />;
  }

  return <>{children}</>;
}
