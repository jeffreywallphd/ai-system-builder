import { useParams } from "react-router-dom";
import "./PageStyles.css";

export default function WorkflowEditorPage(): JSX.Element {
  const { workflowId } = useParams<{ workflowId: string }>();

  return (
    <section className="page-shell">
      <div className="page-hero">
        <div>
          <h1 className="page-title">Workflow Editor</h1>
          <p className="page-subtitle">
            {workflowId
              ? `Editing workflow: ${workflowId}`
              : "Create and edit workflow graphs."}
          </p>
        </div>
      </div>

      <div className="page-grid page-grid--editor">
        <section className="page-card">
          <h2>Metadata</h2>
          <p>Workflow title, description, runtime profile, and save state.</p>
        </section>

        <section className="page-card">
          <h2>Canvas</h2>
          <p>The visual workflow canvas will live here.</p>
        </section>

        <section className="page-card">
          <h2>Inspector</h2>
          <p>Selected node and property editing will appear here.</p>
        </section>
      </div>
    </section>
  );
}
