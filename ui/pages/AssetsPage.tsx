import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUiDependencies } from "../composition/AppProviders";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { UiSettingsState } from "../settings/UiSettingsStore";

export default function AssetsPage(): JSX.Element {
  const { settingsStore } = useUiDependencies();
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());

  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Assets</h1>
          <p className="ui-page__subtitle">
            Browse generated and stored workflow assets.
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <p className="ui-text-secondary">
            This page will host asset listings, previews, and metadata inspection.
          </p>
          <div className="ui-settings-page__path-summary">
            <div>
              <strong>Inputs:</strong> {settingsState.settings.workspace.inputsDirectory}
            </div>
            <div>
              <strong>Outputs:</strong> {settingsState.settings.workspace.outputsDirectory}
            </div>
          </div>
          <p className="ui-text-small ui-text-secondary">
            Need to move these folders? Update them in <Link to={ROUTE_PATHS.settings}>Settings</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
