import { useActiveWorkspace, WorkspaceSwitcher } from "../features/workspace";
import type { DesktopPageKey } from "../routes/desktopPages";

export interface HomePageProps {
  readonly onNavigate: (nextPage: DesktopPageKey) => void;
}

type HomeAreaCard = {
  readonly key: Extract<DesktopPageKey, "system" | "artifacts" | "assets" | "models" | "image-generation">;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly buttonLabel: string;
};

const homeAreaCards: readonly HomeAreaCard[] = [
  {
    key: "system",
    title: "System",
    eyebrow: "Runtime and diagnostics",
    description: "Check local runtime readiness, provider status, and system diagnostics before starting workspace work.",
    buttonLabel: "Open System",
  },
  {
    key: "artifacts",
    title: "Data",
    eyebrow: "Inputs and artifacts",
    description: "Upload files, inspect stored artifacts, and keep workspace source material organized.",
    buttonLabel: "Open Data",
  },
  {
    key: "assets",
    title: "Assets",
    eyebrow: "Workspace library",
    description: "Browse system defaults, resource-backed views, and workspace-visible asset definitions.",
    buttonLabel: "Open Assets",
  },
  {
    key: "models",
    title: "Models",
    eyebrow: "Model inventory",
    description: "Manage saved model references and prepare model records for workspace workflows.",
    buttonLabel: "Open Models",
  },
  {
    key: "image-generation",
    title: "Image Generation",
    eyebrow: "Generate visual outputs",
    description: "Create image outputs from prompts and route finished work into the asset pipeline.",
    buttonLabel: "Open Image Generation",
  },
];

export function HomePage({ onNavigate }: HomePageProps) {
  const workspace = useActiveWorkspace();
  const activeWorkspaceName = workspace.activeWorkspace?.displayName;

  return (
    <section className="home-page ui-stack ui-stack--lg" aria-labelledby="home-title">
      <div className="ui-panel ui-panel--elevated home-workspace-card ui-stack">
        <div className="home-card__header">
          <div className="ui-stack ui-stack--sm">
            <p className="home-card__eyebrow">Workspace</p>
            <h2 id="home-title" className="ui-panel__title">Choose your working context</h2>
            <p className="ui-text-muted">
              Workspace selection controls which project resources are visible across Data, Assets, Models, and Image Generation.
            </p>
          </div>
          {activeWorkspaceName ? <p className="ui-status">Active workspace: {activeWorkspaceName}</p> : null}
        </div>
        <WorkspaceSwitcher />
      </div>

      <div className="home-areas" aria-label="Application areas">
        {homeAreaCards.map((card) => (
          <article
            key={card.key}
            className={`ui-panel home-area-card ui-stack ui-stack--sm${card.key === "system" ? " home-area-card--wide" : ""}`}
          >
            <div className="home-card__header">
              <div>
                <p className="home-card__eyebrow">{card.eyebrow}</p>
                <h3>{card.title}</h3>
              </div>
            </div>
            <p className="ui-text-muted">{card.description}</p>
            <div className="home-area-card__actions">
              <button className="ui-button" type="button" onClick={() => onNavigate(card.key)}>
                {card.buttonLabel}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
