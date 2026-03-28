import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BuildEntryService, type BuildIntentOption, type BuildIntentSelection } from "../routes/BuildEntry";
import { InlineRunLaunchService } from "../routes/InlineRunActions";
import { UxRunActionKinds } from "../runtime/UxRuntimeService";

function createSelection(intent: BuildIntentOption["intent"]): BuildIntentSelection {
  return Object.freeze({
    intent,
    selectedAtIso: new Date().toISOString(),
  });
}

export default function BuildPage(): JSX.Element {
  const service = useMemo(() => new BuildEntryService(), []);
  const inlineRunLaunchService = useMemo(() => new InlineRunLaunchService(), []);
  const navigate = useNavigate();
  const model = service.getLandingModel();

  const runHere = inlineRunLaunchService.launch({
    action: UxRunActionKinds.run,
    target: { kind: "general" },
    context: { source: "build", originPath: "/build", originLabel: "Build" },
  });

  const testHere = inlineRunLaunchService.launch({
    action: UxRunActionKinds.test,
    target: { kind: "general" },
    context: { source: "build", originPath: "/build", originLabel: "Build" },
  });

  const onSelectIntent = (intent: BuildIntentOption["intent"]): void => {
    const launchContext = service.resolveIntentLaunchContext({
      selection: createSelection(intent),
      entryContext: { source: "intent" },
    });
    void navigate(launchContext.launchPath);
  };

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="build-landing-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{model.title}</h1>
          <p className="ui-page__subtitle">{model.subtitle}</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <h2 style={{ margin: 0 }}>{model.prompt}</h2>
          <p className="ui-text-secondary" style={{ margin: 0 }}>
            Choose an intent to continue. You can refine details in the next step.
          </p>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            <Link className="ui-button ui-button--ghost ui-button--small" to={runHere.launchPath}>Run here</Link>
            <Link className="ui-button ui-button--ghost ui-button--small" to={testHere.launchPath}>Test here</Link>
          </div>
        </div>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {model.options.map((option) => (
          <article key={option.intent} className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--sm">
              <div className="ui-stack ui-stack--2xs">
                <h3 style={{ margin: 0 }}>{option.label}</h3>
                <p className="ui-text-secondary" style={{ margin: 0 }}>{option.description}</p>
              </div>
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--sm"
                onClick={() => onSelectIntent(option.intent)}
              >
                {option.callToAction}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
