import { useId, useState } from "react";

import { useActiveWorkspace } from "../hooks/useActiveWorkspace";
import { WorkspaceCreateForm } from "./WorkspaceCreateForm";

export function WorkspaceSwitcher() {
  const workspace = useActiveWorkspace();
  const selectId = useId();
  const [creating, setCreating] = useState(false);
  const activeWorkspaces = workspace.workspaces.filter((candidate) => candidate.status === "active");

  if (workspace.loading) {
    return <section className="workspace-switcher" aria-label="Workspace"><span>Workspace: Loading...</span></section>;
  }

  return (
    <section className="workspace-switcher ui-stack ui-stack--xs" aria-label="Workspace">
      <div className="ui-cluster">
        <label htmlFor={selectId}>
          <strong>{workspace.activeWorkspace ? `Workspace: ${workspace.activeWorkspace.displayName}` : "No workspace selected"}</strong>
        </label>
        {activeWorkspaces.length > 0 ? (
          <select
            id={selectId}
            className="ui-input"
            aria-label="Select workspace"
            value={workspace.activeWorkspace?.id ?? ""}
            onChange={(event) => {
              if (event.currentTarget.value) void workspace.selectWorkspace(event.currentTarget.value);
            }}
          >
            <option value="">Select workspace</option>
            {activeWorkspaces.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>
            ))}
          </select>
        ) : null}
        <button className="ui-button" type="button" onClick={() => setCreating((current) => !current)}>Create workspace</button>
      </div>
      {workspace.error ? <p className="ui-status ui-status--error" role="alert">{workspace.error}</p> : null}
      {workspace.activeWorkspaceId && !workspace.activeWorkspace ? <p className="ui-status ui-status--error" role="alert">This workspace is unavailable. Select or create another workspace.</p> : null}
      {creating ? <WorkspaceCreateForm compact onCreated={() => setCreating(false)} /> : null}
    </section>
  );
}
