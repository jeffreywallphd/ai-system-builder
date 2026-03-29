import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BuildEntryService, BuildIntents, type BuildIntent } from "../routes/BuildEntry";
import { ROUTE_PATHS } from "../routes/RouteConfig";

export interface BuildTemplateCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: "Beginner" | "Intermediate" | "Advanced";
}

const buildTemplateCards: ReadonlyArray<BuildTemplateCard> = Object.freeze([
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
  const model = useMemo(() => buildEntryService.getLandingModel(), [buildEntryService]);
  const [launchError, setLaunchError] = useState<string | undefined>();

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
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
