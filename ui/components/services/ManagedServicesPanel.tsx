import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import type { ManagedServiceRecord } from "../../services/ManagedServicesService";
import { ManagedServicePresenter } from "../../presenters/ManagedServicePresenter";

export interface ManagedServicesPanelProps {
  readonly services: ReadonlyArray<ManagedServiceRecord>;
  readonly selectedServiceId?: string;
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly error?: string;
  readonly onSelectService: (serviceId: string) => void;
  readonly onRefresh: () => void;
  readonly onStart: (serviceId: string) => void;
  readonly onStop: (serviceId: string) => void;
  readonly onRestart: (serviceId: string) => void;
  readonly onEnsureRunning: (serviceId: string) => void;
}

const presenter = new ManagedServicePresenter();

export default function ManagedServicesPanel({
  services,
  selectedServiceId,
  recentLogs,
  isLoading,
  isMutating,
  error,
  onSelectService,
  onRefresh,
  onStart,
  onStop,
  onRestart,
  onEnsureRunning,
}: ManagedServicesPanelProps): JSX.Element {
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];

  return (
    <div className="ui-managed-services ui-stack ui-stack--md">
      <div className="ui-card">
        <div className="ui-card__body ui-managed-services__toolbar">
          <div className="ui-stack ui-stack--2xs">
            <strong>Managed runtime services</strong>
            <span className="ui-text-secondary ui-text-small">
              Lightweight service controls for local and mobile administration.
            </span>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={onRefresh}
            disabled={isLoading || isMutating}
          >
            Refresh status
          </button>
        </div>
      </div>

      {error ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <strong>Service error</strong>
            <p className="ui-text-secondary" style={{ marginBottom: 0 }}>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="ui-managed-services__layout">
        <section className="ui-stack ui-stack--sm">
          {services.map((service) => {
            const isSelected = service.id === selectedService?.id;
            return (
              <button
                key={service.id}
                type="button"
                className={`ui-card ui-managed-services__service-card${isSelected ? " ui-managed-services__service-card--selected" : ""}`}
                onClick={() => onSelectService(service.id)}
              >
                <div className="ui-card__body ui-stack ui-stack--xs">
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
                    <strong>{service.name}</strong>
                    <span className="ui-badge ui-badge--neutral">{presenter.presentState(service)}</span>
                  </div>
                  <div className="ui-meta-grid">
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Ownership</span>
                      <span className="ui-meta-value">{presenter.presentOwnership(service)}</span>
                    </div>
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Availability</span>
                      <span className="ui-meta-value">{presenter.presentAvailability(service)}</span>
                    </div>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Endpoint</span>
                    <span className="ui-meta-value">{presenter.presentEndpointSummary(service)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className="ui-stack ui-stack--md">
          {selectedService ? (
            <>
              <div className="ui-card">
                <div className="ui-card__body ui-stack ui-stack--sm">
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                    <div className="ui-stack ui-stack--2xs">
                      <h2 className="ui-card__title">{selectedService.name}</h2>
                      <span className="ui-card__subtitle">{selectedService.description ?? "Service lifecycle controls and health details."}</span>
                    </div>
                    <div className="ui-chips">
                      <span className="ui-badge ui-badge--neutral">{presenter.presentState(selectedService)}</span>
                      <span className="ui-badge ui-badge--neutral">{presenter.presentOwnership(selectedService)}</span>
                    </div>
                  </div>

                  <div className="ui-meta-grid ui-managed-services__meta-grid">
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Current state</span>
                      <span className="ui-meta-value">{presenter.presentState(selectedService)}</span>
                    </div>
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Ownership</span>
                      <span className="ui-meta-value">{presenter.presentOwnership(selectedService)}</span>
                    </div>
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Base URL / endpoints</span>
                      <span className="ui-meta-value">{presenter.presentEndpointSummary(selectedService)}</span>
                    </div>
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Last checked</span>
                      <span className="ui-meta-value">{presenter.presentLastChecked(selectedService)}</span>
                    </div>
                    <div className="ui-meta-item ui-managed-services__meta-item--full">
                      <span className="ui-meta-label">Last error detail</span>
                      <span className="ui-meta-value">{presenter.presentErrorDetail(selectedService)}</span>
                    </div>
                  </div>

                  <div className="ui-managed-services__actions">
                    <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={isLoading || isMutating} onClick={() => onStart(selectedService.id)}>
                      Start
                    </button>
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={isLoading || isMutating} onClick={() => onStop(selectedService.id)}>
                      Stop
                    </button>
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={isLoading || isMutating} onClick={() => onRestart(selectedService.id)}>
                      Restart
                    </button>
                    <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading || isMutating} onClick={() => onEnsureRunning(selectedService.id)}>
                      Ensure running
                    </button>
                  </div>
                </div>
              </div>

              <div className="ui-card">
                <div className="ui-card__body ui-stack ui-stack--sm">
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                    <div>
                      <h3 className="ui-card__title">Recent logs</h3>
                      <p className="ui-card__subtitle">Recent stdout/stderr and supervisor events emitted for the selected service.</p>
                    </div>
                    <span className="ui-badge ui-badge--neutral">{recentLogs.length} events</span>
                  </div>

                  <div className="ui-managed-services__log-list ui-scrollbar">
                    {recentLogs.length > 0 ? recentLogs.map((event) => (
                      <article key={event.id} className="ui-managed-services__log-entry">
                        <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
                          <strong>{event.severity}</strong>
                          <span className="ui-subtle">{event.timestamp}</span>
                        </div>
                        <div>{event.message}</div>
                      </article>
                    )) : <p className="ui-text-secondary" style={{ margin: 0 }}>No recent service logs.</p>}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="ui-card">
              <div className="ui-card__body">
                <p className="ui-text-secondary" style={{ margin: 0 }}>No managed services are configured.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
