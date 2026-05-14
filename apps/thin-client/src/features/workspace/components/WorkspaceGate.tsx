import { useState, type ReactNode } from "react";

import { useActiveWorkspace, type WorkspaceUiRecord } from "../hooks/useActiveWorkspace";

export const WORKSPACE_REQUIRED_MESSAGE = "Create a workspace to use Assets, Artifacts, Data, Models, and Images.";

export interface WorkspaceGateProps {
  pageLabel: string;
  children: ReactNode | ((workspace: WorkspaceUiRecord) => ReactNode);
}

export function WorkspaceGate({ pageLabel, children }: WorkspaceGateProps) {
  const workspace = useActiveWorkspace();
  const [workspaceName, setWorkspaceName] = useState("");
  const [includeFoundation, setIncludeFoundation] = useState(true);

  if (workspace.loading) {
    return <section className="ui-panel ui-stack ui-stack--sm"><p>Loading workspaces...</p></section>;
  }

  if (workspace.activeWorkspace) {
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
        {workspace.error ? <p className="ui-status ui-status--error" role="alert">{workspace.error}</p> : null}
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
      <form className="ui-stack ui-stack--sm" onSubmit={(event) => {
        event.preventDefault();
        try {
          workspace.createWorkspace({ name: workspaceName, includeSystemFoundationAssets: includeFoundation });
          setWorkspaceName("");
        } catch {
          // The context exposes a safe user-facing error.
        }
      }}>
        <h3>Create workspace</h3>
        <label className="ui-field">
          <span>Workspace name</span>
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.currentTarget.value)} placeholder="My Project" />
        </label>
        <label className="ui-checkbox">
          <input type="checkbox" checked={includeFoundation} onChange={(event) => setIncludeFoundation(event.currentTarget.checked)} />
          <span>Include System Foundation assets</span>
        </label>
        <button className="ui-button ui-button--primary" type="submit">Create workspace</button>
      </form>
    </section>
  );
}
