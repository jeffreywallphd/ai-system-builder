import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import heroDashboard from "../images/home-hero-dashboard.svg";
import workflowsImage from "../images/section-workflows.svg";
import modelsImage from "../images/section-models.svg";
import toolsImage from "../images/section-tools.svg";
import assetsImage from "../images/section-assets.svg";

interface LandingMetric {
  readonly value: string;
  readonly label: string;
}

interface LandingFeatureCard {
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly primaryLabel: string;
  readonly primaryTo: string;
  readonly secondaryLabel: string;
  readonly secondaryTo: string;
}

interface LandingQuickLink {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly to: string;
  readonly label: string;
}

const landingMetrics: ReadonlyArray<LandingMetric> = Object.freeze([
  Object.freeze({ value: "4", label: "core workspaces connected" }),
  Object.freeze({ value: "1", label: "guided canvas for building workflows" }),
  Object.freeze({ value: "24/7", label: "visibility into runs, models, and assets" }),
]);

const landingFeatureCards: ReadonlyArray<LandingFeatureCard> = Object.freeze([
  Object.freeze({
    title: "Workflow orchestration",
    description:
      "Design graph-based automations, validate them in context, and move from idea to execution without leaving the canvas.",
    image: workflowsImage,
    primaryLabel: "Open workflows",
    primaryTo: ROUTE_PATHS.workflows,
    secondaryLabel: "Start a new workflow",
    secondaryTo: `${ROUTE_PATHS.workflows}/new`,
  }),
  Object.freeze({
    title: "Ready-to-run tools",
    description:
      "Launch published tools for focused tasks, review inputs quickly, and bring structured AI capability to every team.",
    image: toolsImage,
    primaryLabel: "Browse tools",
    primaryTo: ROUTE_PATHS.tools,
    secondaryLabel: "Open tool hub",
    secondaryTo: ROUTE_PATHS.tools,
  }),
  Object.freeze({
    title: "Model operations",
    description:
      "Search remote catalogs, compare install targets, and curate the model stack behind your automation strategy.",
    image: modelsImage,
    primaryLabel: "Explore models",
    primaryTo: ROUTE_PATHS.models,
    secondaryLabel: "Review compatibility",
    secondaryTo: ROUTE_PATHS.models,
  }),
  Object.freeze({
    title: "Asset visibility",
    description:
      "Keep generated outputs, references, and workflow artifacts organized so teams can audit results and reuse what matters.",
    image: assetsImage,
    primaryLabel: "View assets",
    primaryTo: ROUTE_PATHS.assets,
    secondaryLabel: "Inspect outputs",
    secondaryTo: ROUTE_PATHS.assets,
  }),
]);

const landingQuickLinks: ReadonlyArray<LandingQuickLink> = Object.freeze([
  Object.freeze({
    eyebrow: "Build",
    title: "Map every AI step",
    description:
      "Use the visual editor to connect models, tools, inputs, and outputs in a workflow your whole team can understand.",
    to: ROUTE_PATHS.workflows,
    label: "Go to workflows",
  }),
  Object.freeze({
    eyebrow: "Operate",
    title: "Run tools without the overhead",
    description:
      "Open lightweight task flows for common operations when you need results fast and still want governed AI usage.",
    to: ROUTE_PATHS.tools,
    label: "Go to tools",
  }),
  Object.freeze({
    eyebrow: "Scale",
    title: "Curate the right model mix",
    description:
      "Balance remote discovery with installed inventory so teams can standardize on the best runtimes for each job.",
    to: ROUTE_PATHS.models,
    label: "Go to models",
  }),
]);

export default function HomePage(): JSX.Element {
  return (
    <section className="ui-page ui-home">
      <div className="ui-home__hero ui-glow-accent">
        <div className="ui-home__hero-copy">
          <span className="ui-home__eyebrow">AI Loom Studio</span>
          <h1 className="ui-page__title ui-home__title">
            AI Loom Studio for teams building polished, production-ready AI experiences.
          </h1>
          <p className="ui-page__subtitle ui-home__subtitle">
            Bring workflows, tools, models, and assets into one branded control surface designed for confident execution,
            faster iteration, and better visibility from prototype to delivery.
          </p>

          <div className="ui-page__actions ui-home__actions">
            <Link className="ui-button ui-button--primary ui-button--md" to={ROUTE_PATHS.workflows}>
              Open Workflow Studio
            </Link>
            <Link className="ui-button ui-button--secondary ui-button--md" to={ROUTE_PATHS.tools}>
              Explore Tools
            </Link>
            <Link className="ui-button ui-button--ghost ui-button--md" to={ROUTE_PATHS.models}>
              Browse Models
            </Link>
          </div>

          <div className="ui-home__metrics" aria-label="Platform highlights">
            {landingMetrics.map((metric) => (
              <article key={metric.label} className="ui-home__metric-card">
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="ui-home__hero-panel">
          <div className="ui-home__hero-panel-header">
            <div>
              <span className="ui-home__eyebrow">Live overview</span>
              <h2>Studio dashboard preview</h2>
            </div>
            <span className="ui-home__status-pill">Ready to orchestrate</span>
          </div>

          <img
            className="ui-home__hero-image"
            src={heroDashboard}
            alt="Illustrated AI Loom Studio dashboard showing workflow performance and operational panels"
          />

          <div className="ui-home__dashboard-grid">
            <article className="ui-home__dashboard-card">
              <span>Workflow canvas</span>
              <strong>Graph-first editing</strong>
              <p>Design nodes, validate dependencies, and keep execution context close at hand.</p>
            </article>
            <article className="ui-home__dashboard-card">
              <span>Tool hub</span>
              <strong>Reusable AI actions</strong>
              <p>Give operators direct access to governed capabilities with searchable publishing.</p>
            </article>
            <article className="ui-home__dashboard-card">
              <span>Asset tracking</span>
              <strong>Outputs with provenance</strong>
              <p>Maintain visibility into generated files, references, and what each run produced.</p>
            </article>
          </div>
        </div>
      </div>

      <div className="ui-home__quick-links">
        {landingQuickLinks.map((item) => (
          <article key={item.title} className="ui-home__quick-link ui-card">
            <div className="ui-card__body ui-stack ui-stack--sm">
              <span className="ui-home__eyebrow">{item.eyebrow}</span>
              <h2 className="ui-heading-4">{item.title}</h2>
              <p className="ui-text-secondary">{item.description}</p>
              <Link className="ui-home__text-link" to={item.to}>
                {item.label}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="ui-home__section-heading">
        <div>
          <span className="ui-home__eyebrow">Platform tour</span>
          <h2 className="ui-heading-2">A marketing landing page with direct paths into the working product.</h2>
        </div>
        <p className="ui-text-secondary">
          Each area below pairs the platform story with a task-focused action so visitors can move from discovery into the software immediately.
        </p>
      </div>

      <div className="ui-home__feature-grid">
        {landingFeatureCards.map((feature) => (
          <article key={feature.title} className="ui-home__feature-card ui-glow-accent">
            <img className="ui-home__feature-image" src={feature.image} alt="" aria-hidden="true" />
            <div className="ui-home__feature-copy">
              <h3 className="ui-heading-4">{feature.title}</h3>
              <p className="ui-text-secondary">{feature.description}</p>
            </div>
            <div className="ui-home__feature-actions">
              <Link className="ui-button ui-button--primary ui-button--sm" to={feature.primaryTo}>
                {feature.primaryLabel}
              </Link>
              <Link className="ui-button ui-button--secondary ui-button--sm" to={feature.secondaryTo}>
                {feature.secondaryLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <section className="ui-home__platform-band ui-glow-accent">
        <div>
          <span className="ui-home__eyebrow">Why teams choose it</span>
          <h2 className="ui-heading-2">A single surface for AI delivery, not a loose collection of screens.</h2>
        </div>
        <div className="ui-home__platform-band-grid">
          <article>
            <strong>Fewer handoffs</strong>
            <p className="ui-text-secondary">Marketing polish meets operator workflows so the homepage feels like the product it represents.</p>
          </article>
          <article>
            <strong>Faster onboarding</strong>
            <p className="ui-text-secondary">Give new users a clear path into workflows, tools, models, and assets from the first visit.</p>
          </article>
          <article>
            <strong>Brand-consistent trust</strong>
            <p className="ui-text-secondary">A refreshed visual system carries the AI Loom Studio identity through navigation, content, and illustrations.</p>
          </article>
        </div>
      </section>
    </section>
  );
}
