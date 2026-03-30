import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { WorkflowConversationMessageRoles } from "../workflow-conversation/WorkflowConversationContracts";
import type { WorkflowConversationSessionService } from "../workflow-conversation/WorkflowConversationSessionService";

export interface WorkflowConversationPageProps {
  readonly conversationSessionService?: WorkflowConversationSessionService;
}

export default function WorkflowConversationPage({
  conversationSessionService: serviceProp,
}: WorkflowConversationPageProps): JSX.Element {
  const { workflowConversationSessionService } = useUiDependencies();
  const service = serviceProp ?? workflowConversationSessionService;
  const navigate = useNavigate();
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const session = useMemo(
    () => service.getById(sessionId),
    [service, sessionId, isSubmitting],
  );

  if (!session) {
    return (
      <section className="ui-page ui-stack ui-stack--md" data-testid="workflow-conversation-page-empty">
        <div className="ui-page__hero">
          <div className="ui-page__hero-copy">
            <h1 className="ui-page__title">Workflow conversation</h1>
            <p className="ui-page__subtitle">Conversation session was not found. It may have expired or never existed.</p>
          </div>
        </div>
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-text-secondary">Open a workflow and run an eligible prompt-response execution to start a conversation.</div>
            <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
              <Link className="ui-button ui-button--primary ui-button--sm" to={ROUTE_PATHS.workflows}>Open workflows</Link>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => navigate(-1)}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    const message = draft.trim();
    if (!message) {
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    try {
      await service.continueSession({
        sessionId: session.id,
        message,
      });
      setDraft("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to continue workflow conversation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="workflow-conversation-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{session.metadata.title}</h1>
          <p className="ui-page__subtitle">
            Workflow: {session.metadata.workflowName} ({session.metadata.workflowId})
          </p>
        </div>
      </div>

      {error || session.lastError ? (
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--xs">
            <span className="ui-badge ui-badge--danger">Conversation error</span>
            <div className="ui-text-secondary">{error ?? session.lastError}</div>
          </div>
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm" data-testid="workflow-conversation-messages">
          {session.messages.length === 0 ? (
            <div className="ui-text-secondary">No messages yet.</div>
          ) : (
            session.messages.map((message) => (
              <article key={message.id} className="ui-card" data-testid={`workflow-conversation-message-${message.role}`}>
                <div className="ui-card__body ui-stack ui-stack--2xs">
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                    <span
                      className={`ui-badge ${message.role === WorkflowConversationMessageRoles.user ? "ui-badge--accent" : message.role === WorkflowConversationMessageRoles.assistant ? "ui-badge--neutral" : "ui-badge--warning"}`}
                    >
                      {message.role}
                    </span>
                    <span className="ui-text-secondary ui-text-small">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>{message.content}</div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <label className="ui-field ui-stack ui-stack--2xs" htmlFor="workflow-conversation-input">
            <span className="ui-field__label">Continue conversation</span>
            <textarea
              id="workflow-conversation-input"
              className="ui-input"
              rows={4}
              value={draft}
              data-testid="workflow-conversation-input"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your next message"
            />
          </label>
          <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--sm"
              data-testid="workflow-conversation-submit"
              disabled={isSubmitting || !draft.trim()}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {isSubmitting ? "Sending..." : "Send"}
            </button>
            <Link className="ui-button ui-button--ghost ui-button--sm" to={ROUTE_PATHS.workflows}>
              Back to workflows
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
