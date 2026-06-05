import { useActiveWorkspace, WorkspaceSwitcher } from "../features/workspace";
import type { ThinClientPageKey } from "../routes/thinClientPages";

export interface HomePageProps {
  onNavigate: (nextPage: ThinClientPageKey) => void;
}

type HomeAreaCard = {
  readonly key: Extract<ThinClientPageKey, "artifacts" | "assets" | "user-library" | "models" | "image-generation" | "security">;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly buttonLabel: string;
  readonly illustration: HomeCardIllustrationKind;
};

type HomeCardIllustrationKind = "workspace" | "data" | "assets" | "library" | "models" | "image-generation" | "security";

const homeAreaCards: readonly HomeAreaCard[] = [
  {
    key: "artifacts",
    title: "Data",
    eyebrow: "Inputs and artifacts",
    description: "Upload files, scrape web pages, inspect stored artifacts, and keep workspace source material organized.",
    buttonLabel: "Open Data",
    illustration: "data",
  },
  {
    key: "assets",
    title: "Assets",
    eyebrow: "Workspace library",
    description: "Browse system defaults, shared resources, and workspace-visible asset definitions.",
    buttonLabel: "Open Assets",
    illustration: "assets",
  },
  {
    key: "user-library",
    title: "Reusable Library",
    eyebrow: "Cross-workspace reuse",
    description: "Review reusable assets and workspace links without duplicating shared source material.",
    buttonLabel: "Open Library",
    illustration: "library",
  },
  {
    key: "models",
    title: "Models",
    eyebrow: "Model inventory",
    description: "Manage saved model references from workspace storage and shared model locations.",
    buttonLabel: "Open Models",
    illustration: "models",
  },
  {
    key: "image-generation",
    title: "Image Generation",
    eyebrow: "Generate visual outputs",
    description: "Create image outputs from prompts and route finished work into the asset pipeline.",
    buttonLabel: "Open Image Generation",
    illustration: "image-generation",
  },
  {
    key: "security",
    title: "Security",
    eyebrow: "Connection settings",
    description: "Review thin-client pairing, server connection, and token status for this browser session.",
    buttonLabel: "Open Security",
    illustration: "security",
  },
];

function HomeCardIllustration({ kind }: { readonly kind: HomeCardIllustrationKind }) {
  if (kind === "workspace") {
    return (
      <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
        <rect x="14" y="12" width="68" height="48" rx="8" />
        <path d="M28 24h20M28 34h40M28 44h24" />
        <circle cx="68" cy="24" r="6" />
        <path d="M63 48 70 37l7 11H63Z" />
      </svg>
    );
  }

  if (kind === "data") {
    return (
      <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
        <path d="M28 10h28l14 14v36H28V10Z" />
        <path d="M56 10v15h14M38 34h22M38 44h18" />
        <rect x="18" y="22" width="18" height="28" rx="4" />
        <path d="M23 32h8M23 40h8" />
      </svg>
    );
  }

  if (kind === "assets") {
    return (
      <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
        <rect x="20" y="14" width="24" height="20" rx="5" />
        <rect x="52" y="14" width="24" height="20" rx="5" />
        <rect x="36" y="40" width="24" height="20" rx="5" />
        <path d="M44 24h8M48 34v6M32 34l8 8M64 34l-8 8" />
      </svg>
    );
  }

  if (kind === "library") {
    return (
      <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
        <rect x="20" y="14" width="56" height="42" rx="6" />
        <path d="M32 24h32M32 34h24M32 44h30" />
        <path d="M24 18v-4h44v4M28 56v4h44v-4" />
      </svg>
    );
  }

  if (kind === "models") {
    return (
      <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
        <circle cx="26" cy="36" r="9" />
        <circle cx="48" cy="18" r="9" />
        <circle cx="70" cy="36" r="9" />
        <circle cx="48" cy="56" r="9" />
        <path d="m34 30 7-6M56 24l7 6M35 42l6 7M61 43l-6 7M35 36h26" />
      </svg>
    );
  }

  if (kind === "security") {
    return (
      <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
        <path d="M48 10 72 20v16c0 15-10 24-24 30-14-6-24-15-24-30V20l24-10Z" />
        <path d="M38 36h20M42 46h12M48 28v18" />
      </svg>
    );
  }

  return (
    <svg className="home-card-illustration" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
      <rect x="18" y="14" width="60" height="44" rx="8" />
      <circle cx="60" cy="28" r="6" />
      <path d="m26 50 15-16 11 11 7-7 11 12" />
      <path d="M24 10v8M20 14h8M78 42v8M74 46h8" />
    </svg>
  );
}

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
              Workspace selection controls which resources are visible across Data, Assets, Models, and Image Generation.
            </p>
          </div>
          <HomeCardIllustration kind="workspace" />
          {activeWorkspaceName ? <p className="ui-status">Active workspace: {activeWorkspaceName}</p> : null}
        </div>
        <WorkspaceSwitcher />
      </div>

      <div className="home-areas" aria-label="Application areas">
        {homeAreaCards.map((card) => (
          <article key={card.key} className="ui-panel home-area-card ui-stack ui-stack--sm">
            <div className="home-card__header">
              <div>
                <p className="home-card__eyebrow">{card.eyebrow}</p>
                <h3>{card.title}</h3>
              </div>
              <HomeCardIllustration kind={card.illustration} />
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
