import { useState } from "react";

import { useActiveWorkspace } from "../hooks/useActiveWorkspace";

export interface WorkspaceCreateFormProps {
  readonly compact?: boolean;
  readonly onCreated?: () => void;
}

export function WorkspaceCreateForm({ compact = false, onCreated }: WorkspaceCreateFormProps) {
  const workspace = useActiveWorkspace();
  const [workspaceName, setWorkspaceName] = useState("");
  const [includeFoundation, setIncludeFoundation] = useState(true);

  return (
    <form className="ui-stack ui-stack--sm workspace-create-form" onSubmit={(event) => {
      event.preventDefault();
      const formWorkspaceName = new FormData(event.currentTarget).get("workspaceName");
      void workspace.createWorkspace({ name: typeof formWorkspaceName === "string" ? formWorkspaceName : workspaceName, includeSystemFoundationAssets: includeFoundation })
        .then(() => {
          setWorkspaceName("");
          onCreated?.();
        })
        .catch(() => {
          // The workspace context exposes safe user-facing error text.
        });
    }}>
      <h3>{compact ? "Create workspace" : "Create a workspace"}</h3>
      <label className="ui-field">
        <span>Name</span>
        <input name="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.currentTarget.value)} placeholder="My Project" />
      </label>
      <label className="ui-checkbox">
        <input type="checkbox" checked={includeFoundation} onChange={(event) => setIncludeFoundation(event.currentTarget.checked)} />
        <span>Include System Foundation assets</span>
      </label>
      {!compact ? <p className="ui-text-muted">Adds reusable UI, form, display, workflow, and system shell assets to this workspace.</p> : null}
      <button className="ui-button ui-button--primary" type="submit">Create workspace</button>
    </form>
  );
}
