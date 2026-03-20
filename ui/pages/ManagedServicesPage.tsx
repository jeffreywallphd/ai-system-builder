import { useEffect, useState } from "react";
import ManagedServicesPanel from "../components/services/ManagedServicesPanel";
import { useUiDependencies } from "../composition/AppProviders";
import type { ManagedServicesStoreState } from "../state/ManagedServicesStore";

const fallbackState: ManagedServicesStoreState = Object.freeze({
  services: Object.freeze([]),
  selectedServiceId: undefined,
  recentLogs: Object.freeze([]),
  isLoading: false,
  isMutating: false,
  error: undefined,
});

export default function ManagedServicesPage(): JSX.Element {
  const { managedServicesStore } = useUiDependencies();
  const [state, setState] = useState<ManagedServicesStoreState>(() => managedServicesStore.getState() || fallbackState);

  useEffect(() => managedServicesStore.subscribe(setState), [managedServicesStore]);

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

      <ManagedServicesPanel
        services={state.services}
        selectedServiceId={state.selectedServiceId}
        recentLogs={state.recentLogs}
        isLoading={state.isLoading}
        isMutating={state.isMutating}
        error={state.error}
        onSelectService={(serviceId) => managedServicesStore.selectService(serviceId)}
        onRefresh={() => void managedServicesStore.refresh().catch(() => undefined)}
        onStart={(serviceId) => void managedServicesStore.start(serviceId).catch(() => undefined)}
        onStop={(serviceId) => void managedServicesStore.stop(serviceId).catch(() => undefined)}
        onRestart={(serviceId) => void managedServicesStore.restart(serviceId).catch(() => undefined)}
        onEnsureRunning={(serviceId) => void managedServicesStore.ensureRunning(serviceId).catch(() => undefined)}
      />
    </section>
  );
}
