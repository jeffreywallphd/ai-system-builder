import { type ReactNode } from "react";

import { useActiveWorkspace, type WorkspaceUiRecord } from "../hooks/useActiveWorkspace";
import { WorkspaceCreateForm } from "./WorkspaceCreateForm";

export const WORKSPACE_REQUIRED_MESSAGE = "Create a workspace to use Assets, Artifacts, Data, Models, and Images.";

export interface WorkspaceGateProps {
  pageLabel: string;
  children: ReactNode | ((workspace: WorkspaceUiRecord) => ReactNode);
}

export function WorkspaceGate({ pageLabel, children }: WorkspaceGateProps) {
  const workspace = useActiveWorkspace();
  if (workspace.status === "loading") {
    return <section className="ui-panel ui-stack ui-stack--sm" aria-label="Workspace loading"><p>Loading workspaces...</p></section>;
  }

  if (workspace.status === "ready" && workspace.activeWorkspace) {
    return (
      <section className="ui-stack ui-stack--sm" aria-label={`${pageLabel} workspace context`}>
        <div className="ui-panel workspace-banner">
          <strong>Active workspace: {workspace.activeWorkspace.displayName}</strong>
          <button className="ui-button" type="button" onClick={workspace.clearActiveWorkspace}>Clear workspace</button>
        </div>
        {typeof children === "function" ? children(workspace.activeWorkspace) : children}
      </section>
    );
  }

  const selectableWorkspaces = workspace.workspaces.filter((candidate) => candidate.status === "active");

  return (
    <section className="ui-panel ui-stack ui-stack--md workspace-gate" aria-label="Workspace required">
      <header className="ui-stack ui-stack--sm">
        <h2>Workspace required</h2>
        <p>{WORKSPACE_REQUIRED_MESSAGE}</p>
        {workspace.status === "unavailable" ? <p className="ui-status ui-status--error" role="alert">This workspace is unavailable. Select or create another workspace.</p> : null}
        {workspace.error && workspace.status !== "unavailable" ? <p className="ui-status ui-status--error" role="alert">{workspace.error}</p> : null}
      </header>
      {selectableWorkspaces.length > 0 ? (
        <div className="ui-stack ui-stack--sm">
          <h3>Select workspace</h3>
          <div className="ui-cluster">
            {selectableWorkspaces.map((candidate) => (
              <button key={candidate.id} className="ui-button" type="button" onClick={() => workspace.selectWorkspace(candidate.id)}>
                Select {candidate.displayName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <WorkspaceCreateForm />
    </section>
  );
}
