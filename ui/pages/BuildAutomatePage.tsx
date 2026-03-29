import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BuildEntryService, BuildIntents } from "../routes/BuildEntry";
import { appendAutomationIntentToPath } from "../routes/BuildAutomationIntent";
import { ROUTE_PATHS } from "../routes/RouteConfig";

const exampleAutomations: ReadonlyArray<string> = Object.freeze([
  "Summarize support tickets every morning and post key actions to Slack.",
  "Classify incoming invoices, extract totals, and queue approvals by vendor.",
  "Generate a weekly product analytics digest and email it to stakeholders.",
]);

export default function BuildAutomatePage(): JSX.Element {
  const navigate = useNavigate();
  const buildEntryService = useMemo(() => new BuildEntryService(), []);
  const [automationIntent, setAutomationIntent] = useState("");
  const [launchError, setLaunchError] = useState<string | undefined>();

  const canContinue = automationIntent.trim().length > 0;

  const onContinue = () => {
    if (!canContinue) {
      return;
    }

    try {
      const launch = buildEntryService.resolveIntentLaunchContext({
        selection: {
          intent: BuildIntents.automateTask,
          selectedAtIso: new Date().toISOString(),
        },
        entryContext: { source: "intent" },
        prefill: { automationIntent: automationIntent.trim() },
      });

      navigate(appendAutomationIntentToPath(launch.launchPath, automationIntent), {
        state: {
          buildIntent: BuildIntents.automateTask,
          automationIntent: automationIntent.trim(),
          buildFlowSessionId: launch.flowSession.sessionId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to launch automation flow.";
      setLaunchError(message);
    }
  };

  return (
    <section className="ui-page ui-stack ui-stack--lg ui-build-automate" data-testid="build-automate-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Automate a task</h1>
          <p className="ui-page__subtitle">
            Describe the task once. AI Loom Studio will open the workflow authoring path with your intent carried forward.
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--md">
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="build-automation-intent">What do you want to automate?</label>
            <textarea
              id="build-automation-intent"
              className="ui-textarea"
              rows={6}
              placeholder="Describe the workflow you want to automate."
              value={automationIntent}
              onChange={(event) => setAutomationIntent(event.target.value)}
            />
            <p className="ui-field__hint">Be specific about the trigger, inputs, and output you need.</p>
          </div>

          <div className="ui-stack ui-stack--xs">
            <p className="ui-subtle">Examples</p>
            <div className="ui-stack ui-stack--2xs">
              {exampleAutomations.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm ui-build-automate__example"
                  onClick={() => setAutomationIntent(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {launchError ? <p role="alert">{launchError}</p> : null}

          <div className="ui-page__actions">
            <button type="button" className="ui-button ui-button--primary ui-button--md" onClick={onContinue} disabled={!canContinue}>
              Continue
            </button>
            <Link to={ROUTE_PATHS.build} className="ui-button ui-button--ghost ui-button--md">
              Back to Build
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
