import { useParams } from "react-router-dom";

export default function WorkflowEditorPage(): JSX.Element {
  const { workflowId } = useParams<{ workflowId: string }>();

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workflow Editor</h1>
          <p className="ui-page__subtitle">
            {workflowId
              ? `Editing workflow: ${workflowId}`
              : "Create and edit workflow graphs."}
          </p>
        </div>
      </div>

      <div className="ui-page-grid ui-page-grid--editor">
        <section className="ui-panel">
          <div className="ui-panel__header">
            <div>
              <div className="ui-panel__title">Metadata</div>
              <div className="ui-panel__subtitle">
                Workflow title, description, runtime profile, and save state.
              </div>
            </div>
          </div>
          <div className="ui-panel__body">
            <p className="ui-text-secondary">
              Workflow title, description, runtime profile, and save state.
            </p>
          </div>
        </section>

        <section className="ui-panel ui-panel--accent ui-glow-accent">
          <div className="ui-panel__header">
            <div>
              <div className="ui-panel__title">Canvas</div>
              <div className="ui-panel__subtitle">
                The visual workflow canvas will live here.
              </div>
            </div>
          </div>
          <div className="ui-panel__body">
            <p className="ui-text-secondary">
              The visual workflow canvas will live here.
            </p>
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel__header">
            <div>
              <div className="ui-panel__title">Inspector</div>
              <div className="ui-panel__subtitle">
                Selected node and property editing will appear here.
              </div>
            </div>
          </div>
          <div className="ui-panel__body">
            <p className="ui-text-secondary">
              Selected node and property editing will appear here.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
