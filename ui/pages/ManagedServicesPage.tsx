import { useEffect, useState } from "react";
import ManagedServicesPanel from "../components/services/ManagedServicesPanel";
import { useUiDependencies } from "../composition/AppProviders";
import type { ManagedServicesStoreState } from "../state/ManagedServicesStore";
import type { RuntimeConsoleState } from "../state/RuntimeConsoleStore";

const fallbackState: ManagedServicesStoreState = Object.freeze({
  services: Object.freeze([]),
  selectedServiceId: undefined,
  recentLogs: Object.freeze([]),
  isLoading: false,
  isMutating: false,
  streamState: "idle",
  error: undefined,
});

export default function ManagedServicesPage(): JSX.Element {
  const { managedServicesStore, runtimeConsoleStore } = useUiDependencies();
  const [state, setState] = useState<ManagedServicesStoreState>(() => managedServicesStore.getState() || fallbackState);
  const [runtimeState, setRuntimeState] = useState<RuntimeConsoleState>(() => runtimeConsoleStore.getState());

  useEffect(() => managedServicesStore.subscribe(setState), [managedServicesStore]);
  useEffect(() => runtimeConsoleStore.subscribe(setRuntimeState), [runtimeConsoleStore]);

  useEffect(() => {
    void managedServicesStore.initialize().catch(() => undefined);
  }, [managedServicesStore]);

  return (
    <section className="ui-page ui-stack ui-stack--md">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Managed Services</h1>
          <p className="ui-page__subtitle">
            Start, stop, restart, and inspect the built-in runtime services from the app, with a compact layout that also works for phone-driven administration.
          </p>
        </div>
      </div>

      {runtimeState.appState !== "ready" ? (
        <div className="ui-card">
          <div className="ui-card__body ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
            <div className="ui-stack ui-stack--2xs">
              <strong>Runtime {runtimeState.appState}</strong>
              <span className="ui-text-secondary ui-text-small">{runtimeState.appStateDetail}</span>
            </div>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              disabled={!runtimeState.canRestartRuntime || runtimeState.isRestartingRuntime}
              onClick={() => void runtimeConsoleStore.restartRuntime().catch(() => undefined)}
            >
              {runtimeState.isRestartingRuntime ? "Restarting…" : "Restart runtime"}
            </button>
          </div>
        </div>
      ) : null}

      <ManagedServicesPanel
        services={state.services}
        selectedServiceId={state.selectedServiceId}
        recentLogs={state.recentLogs}
        isLoading={state.isLoading}
        isMutating={state.isMutating}
        streamState={state.streamState}
        error={state.error}
        onSelectService={(serviceId) => managedServicesStore.selectService(serviceId)}
        onRefresh={() => void managedServicesStore.refresh().catch(() => undefined)}
        onStart={(serviceId) => void managedServicesStore.start(serviceId).catch(() => undefined)}
        onStop={(serviceId) => void managedServicesStore.stop(serviceId).catch(() => undefined)}
        onRestart={(serviceId) => void managedServicesStore.restart(serviceId).catch(() => undefined)}
        onEnsureRunning={(serviceId) => void managedServicesStore.ensureRunning(serviceId).catch(() => undefined)}
        onCreateService={(definition) => void managedServicesStore.createService(definition).catch(() => undefined)}
        onUpdateService={(serviceId, definition) => void managedServicesStore.updateService(serviceId, definition).catch(() => undefined)}
        onRemoveService={(serviceId) => void managedServicesStore.removeService(serviceId).catch(() => undefined)}
      />
    </section>
  );
}
