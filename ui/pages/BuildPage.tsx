import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BuildEntryService, BuildIntents, type BuildIntent } from "../routes/BuildEntry";
import { PersistedWorkflowEntryService, type PersistedWorkflowEntry } from "../routes/PersistedWorkflowEntryService";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { ImageManipulationSystemTemplate } from "../../application/system-studio/ImageManipulationSystemTemplate";

export interface BuildTemplateCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: "Beginner" | "Intermediate" | "Advanced";
  readonly actionPath?: string;
  readonly actionLabel?: string;
}

const buildTemplateCards: ReadonlyArray<BuildTemplateCard> = Object.freeze([
  Object.freeze({
    id: ImageManipulationSystemTemplate.templateId,
    title: "Reference Image Manipulation System",
    description: "Compose a system asset with runtime-owned input/output image dataset instances and explicit workflow/UI boundaries.",
    difficulty: "Intermediate",
    actionPath: `${ROUTE_PATHS.systemStudio}?buildTemplateId=${encodeURIComponent(ImageManipulationSystemTemplate.templateId)}`,
    actionLabel: "Open in System Studio",
  }),
  Object.freeze({
    id: "support-assistant",
    title: "Customer Support Assistant",
    description: "Create an assistant that drafts responses, routes requests, and tracks follow-up actions.",
    difficulty: "Beginner",
  }),
  Object.freeze({
    id: "lead-qualification",
    title: "Lead Qualification Workflow",
    description: "Score inbound leads, enrich contact details, and push qualified prospects into your CRM.",
    difficulty: "Intermediate",
  }),
  Object.freeze({
    id: "content-pipeline",
    title: "Content Production Pipeline",
    description: "Generate briefs, drafts, and channel-specific variants from one structured input.",
    difficulty: "Intermediate",
  }),
  Object.freeze({
    id: "analytics-digest",
    title: "Weekly Analytics Digest",
    description: "Pull key metrics, summarize trends, and publish a stakeholder-ready report automatically.",
    difficulty: "Beginner",
  }),
  Object.freeze({
    id: "document-triage",
    title: "Document Triage System",
    description: "Classify incoming files, extract key fields, and route each document to the right process.",
    difficulty: "Advanced",
  }),
  Object.freeze({
    id: "model-evaluation",
    title: "Model Evaluation Harness",
    description: "Run repeatable evaluation datasets and compare quality scores across prompt or model changes.",
    difficulty: "Advanced",
  }),
]);

export default function BuildPage(): JSX.Element {
  const navigate = useNavigate();
  const buildEntryService = useMemo(() => new BuildEntryService(), []);
  const persistedWorkflowEntryService = useMemo(() => new PersistedWorkflowEntryService(), []);
  const model = useMemo(() => buildEntryService.getLandingModel(), [buildEntryService]);
  const [launchError, setLaunchError] = useState<string | undefined>();
  const [persistedWorkflows, setPersistedWorkflows] = useState<ReadonlyArray<PersistedWorkflowEntry>>([]);
  const [isPersistedWorkflowsLoading, setIsPersistedWorkflowsLoading] = useState(true);
  const [persistedWorkflowsError, setPersistedWorkflowsError] = useState<string | undefined>();

  const onIntentSelected = (intent: BuildIntent) => {
    setLaunchError(undefined);
    if (intent === BuildIntents.automateTask) {
      navigate(ROUTE_PATHS.buildAutomate);
      return;
    }

    try {
      const launch = buildEntryService.resolveIntentLaunchContext({
        selection: {
          intent,
          selectedAtIso: new Date().toISOString(),
        },
        entryContext: { source: "intent" },
      });
      navigate(launch.launchPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open build flow.";
      setLaunchError(message);
    }
  };

  useEffect(() => {
    let active = true;
    setIsPersistedWorkflowsLoading(true);
    void persistedWorkflowEntryService
      .listEntries(6)
      .then((response) => {
        if (!active) {
          return;
        }
        if (!response.ok || !response.data) {
          setPersistedWorkflows([]);
          setPersistedWorkflowsError(response.error ?? "Failed to load persisted workflows.");
          setIsPersistedWorkflowsLoading(false);
          return;
        }
        setPersistedWorkflows(response.data);
        setPersistedWorkflowsError(undefined);
        setIsPersistedWorkflowsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [persistedWorkflowEntryService]);

  return (
    <section className="ui-page ui-stack ui-stack--lg ui-build-landing" data-testid="build-landing-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{model.title}</h1>
          <p className="ui-page__subtitle">{model.subtitle}</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--md">
          <h2 className="ui-build-landing__question">{model.prompt}</h2>
          <div className="ui-grid ui-build-landing__actions" role="group" aria-label="Build actions">
            {model.options.map((option) => (
              <button
                key={option.intent}
                type="button"
                className="ui-button ui-button--secondary ui-button--md ui-build-landing__action"
                onClick={() => onIntentSelected(option.intent)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {launchError ? <p role="alert">{launchError}</p> : null}
        </div>
      </div>

      <section className="ui-stack ui-stack--md" aria-labelledby="build-template-heading">
        <h2 id="build-template-heading" className="ui-build-landing__templates-title">Build from a Template</h2>
        <div className="ui-grid ui-build-landing__template-grid">
          {buildTemplateCards.map((template) => (
            <article key={template.id} className="ui-card ui-card--interactive ui-build-landing__template-card">
              <div className="ui-card__body ui-stack ui-stack--sm">
                <div className="ui-stack ui-stack--2xs">
                  <h3 className="ui-card__title">{template.title}</h3>
                  <p className="ui-card__subtitle">{template.description}</p>
                </div>
                <span className="ui-badge ui-badge--neutral">Difficulty: {template.difficulty}</span>
                {template.actionPath ? (
                  <Link className="ui-button ui-button--ghost ui-button--small" to={template.actionPath}>
                    {template.actionLabel ?? "Open template"}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ui-stack ui-stack--md" aria-labelledby="build-persisted-workflow-heading">
        <h2 id="build-persisted-workflow-heading" className="ui-build-landing__templates-title">Reuse a Saved Workflow</h2>
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            {isPersistedWorkflowsLoading ? <p className="ui-text-secondary">Loading saved workflows...</p> : null}
            {!isPersistedWorkflowsLoading && persistedWorkflowsError ? <p role="alert">{persistedWorkflowsError}</p> : null}
            {!isPersistedWorkflowsLoading && !persistedWorkflowsError && persistedWorkflows.length === 0 ? (
              <p className="ui-text-secondary">No persisted workflows are available yet. Start a new workflow from Build or Explore.</p>
            ) : null}
            {!isPersistedWorkflowsLoading && !persistedWorkflowsError && persistedWorkflows.length > 0 ? (
              <div className="ui-stack ui-stack--xs" data-testid="build-persisted-workflow-list">
                {persistedWorkflows.map((workflow) => (
                  <article key={workflow.workflowId} className="ui-card ui-card--interactive">
                    <div className="ui-card__body ui-stack ui-stack--2xs">
                      <div className="ui-row ui-row--between ui-row--wrap">
                        <strong>{workflow.displayName}</strong>
                        <span className="ui-badge ui-badge--neutral">{workflow.status}</span>
                      </div>
                      <p className="ui-text-small ui-text-secondary">{workflow.workflowId}</p>
                      {workflow.summary ? <p className="ui-text-small ui-text-secondary">{workflow.summary}</p> : null}
                      <div className="ui-row ui-row--wrap">
                        <Link
                          className="ui-button ui-button--secondary ui-button--small"
                          to={persistedWorkflowEntryService.buildWorkflowStudioOpenPath(workflow)}
                        >
                          {workflow.status === "draft" ? "Resume in Workflow Studio" : "Open in Workflow Studio"}
                        </Link>
                        <Link
                          className="ui-button ui-button--ghost ui-button--small"
                          to={persistedWorkflowEntryService.buildWorkflowRunHistoryPath(workflow)}
                        >
                          View run history
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="ui-row ui-row--wrap">
              <Link className="ui-button ui-button--ghost ui-button--small" to={ROUTE_PATHS.explore}>
                Browse more in Explore
              </Link>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
