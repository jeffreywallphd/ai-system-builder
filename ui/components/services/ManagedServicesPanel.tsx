import { useMemo, useState } from "react";
import type { RuntimeEvent } from "../../../application/runtime/RuntimeEvent";
import { ManagedServiceRestartPolicies, type ManagedServiceDefinitionInput } from "../../../application/services/ManagedServiceDefinition";
import { ManagedServiceStartPolicies } from "../../../application/services/interfaces/ManagedServiceTypes";
import type { ManagedServiceRecord } from "../../services/ManagedServicesService";
import { ManagedServicePresenter } from "../../presenters/ManagedServicePresenter";

export interface ManagedServicesPanelProps {
  readonly services: ReadonlyArray<ManagedServiceRecord>;
  readonly selectedServiceId?: string;
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly streamState: "idle" | "connecting" | "live" | "reconnecting";
  readonly error?: string;
  readonly onSelectService: (serviceId: string) => void;
  readonly onRefresh: () => void;
  readonly onStart: (serviceId: string) => void;
  readonly onStop: (serviceId: string) => void;
  readonly onRestart: (serviceId: string) => void;
  readonly onEnsureRunning: (serviceId: string) => void;
  readonly onCreateService: (definition: ManagedServiceDefinitionInput) => void;
  readonly onUpdateService: (serviceId: string, patch: ManagedServiceDefinitionInput) => void;
  readonly onRemoveService: (serviceId: string) => void;
}

interface ServiceEditorState {
  readonly serviceId: string;
  readonly displayName: string;
  readonly description: string;
  readonly kind: ManagedServiceRecord["kind"];
  readonly command: string;
  readonly argsText: string;
  readonly workingDirectory: string;
  readonly envText: string;
  readonly baseUrl: string;
  readonly startupTimeoutMs: string;
  readonly restartPolicy: ManagedServiceRecord["restartPolicy"];
  readonly autoStartPolicy: ManagedServiceRecord["startPolicy"];
}

const presenter = new ManagedServicePresenter();

export default function ManagedServicesPanel({
  services,
  selectedServiceId,
  recentLogs,
  isLoading,
  isMutating,
  streamState,
  error,
  onSelectService,
  onRefresh,
  onStart,
  onStop,
  onRestart,
  onEnsureRunning,
  onCreateService,
  onUpdateService,
  onRemoveService,
}: ManagedServicesPanelProps): JSX.Element {
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];
  const [editorMode, setEditorMode] = useState<"create" | "edit" | undefined>(undefined);
  const [editorState, setEditorState] = useState<ServiceEditorState>(() => createEmptyEditorState());

  const editorTitle = editorMode === "create"
    ? "Create custom service"
    : selectedService?.source === "builtin"
      ? "Configure built-in service"
      : "Edit custom service";

  const helperText = useMemo(() => {
    if (editorMode !== "edit" || !selectedService) {
      return "Register external local servers now so future services can be added without code changes.";
    }

    return selectedService.source === "builtin"
      ? "The Python runtime keeps its protected ID, kind, launch arguments, and restart policy while still allowing safe local configuration changes."
      : "Update command, arguments, environment, and health settings for this custom service.";
  }, [editorMode, selectedService]);

  return (
    <div className="ui-managed-services ui-stack ui-stack--md">
      <div className="ui-card">
        <div className="ui-card__body ui-managed-services__toolbar">
          <div className="ui-stack ui-stack--2xs">
            <strong>Managed runtime services</strong>
            <span className="ui-text-secondary ui-text-small">
              Built-in plus user-defined local services, with persisted definitions and health-aware administration.
            </span>
          </div>
          <div className="ui-managed-services__toolbar-actions">
            <span className="ui-badge ui-badge--neutral" aria-live="polite">
              {presentStreamState(streamState)}
            </span>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => {
                setEditorMode("create");
                setEditorState(createEmptyEditorState());
              }}
              disabled={isLoading || isMutating}
            >
              Add custom service
            </button>
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
      </div>

      {error ? (
        <div className="ui-card">
          <div className="ui-card__body">
            <strong>Service error</strong>
            <p className="ui-text-secondary" style={{ marginBottom: 0 }}>{error}</p>
          </div>
        </div>
      ) : null}

      {editorMode ? (
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
              <div>
                <h2 className="ui-card__title">{editorTitle}</h2>
                <p className="ui-card__subtitle">{helperText}</p>
              </div>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => setEditorMode(undefined)}
                disabled={isLoading || isMutating}
              >
                Cancel
              </button>
            </div>

            <div className="ui-managed-services__editor-grid">
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Service ID</span>
                <input className="ui-input" value={editorState.serviceId} disabled={editorMode === "edit"} onChange={(event) => setEditorState((current) => ({ ...current, serviceId: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Display name</span>
                <input className="ui-input" value={editorState.displayName} onChange={(event) => setEditorState((current) => ({ ...current, displayName: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs ui-managed-services__editor-field--full">
                <span className="ui-meta-label">Description</span>
                <input className="ui-input" value={editorState.description} onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Command / executable</span>
                <input className="ui-input" value={editorState.command} onChange={(event) => setEditorState((current) => ({ ...current, command: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Working directory</span>
                <input className="ui-input" value={editorState.workingDirectory} onChange={(event) => setEditorState((current) => ({ ...current, workingDirectory: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs ui-managed-services__editor-field--full">
                <span className="ui-meta-label">Args (space or comma separated)</span>
                <textarea className="ui-textarea" rows={2} value={editorState.argsText} onChange={(event) => setEditorState((current) => ({ ...current, argsText: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs ui-managed-services__editor-field--full">
                <span className="ui-meta-label">Environment variables (KEY=value, one per line)</span>
                <textarea className="ui-textarea" rows={4} value={editorState.envText} onChange={(event) => setEditorState((current) => ({ ...current, envText: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Health URL / probe</span>
                <input className="ui-input" value={editorState.baseUrl} onChange={(event) => setEditorState((current) => ({ ...current, baseUrl: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Startup timeout (ms)</span>
                <input className="ui-input" inputMode="numeric" value={editorState.startupTimeoutMs} onChange={(event) => setEditorState((current) => ({ ...current, startupTimeoutMs: event.target.value }))} />
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Restart policy</span>
                <select className="ui-input" value={editorState.restartPolicy} onChange={(event) => setEditorState((current) => ({ ...current, restartPolicy: event.target.value as ServiceEditorState["restartPolicy"] }))}>
                  <option value={ManagedServiceRestartPolicies.never}>Never</option>
                  <option value={ManagedServiceRestartPolicies.onFailure}>On failure</option>
                  <option value={ManagedServiceRestartPolicies.always}>Always</option>
                </select>
              </label>
              <label className="ui-stack ui-stack--2xs">
                <span className="ui-meta-label">Auto-start</span>
                <select className="ui-input" value={editorState.autoStartPolicy} onChange={(event) => setEditorState((current) => ({ ...current, autoStartPolicy: event.target.value as ServiceEditorState["autoStartPolicy"] }))}>
                  <option value={ManagedServiceStartPolicies.manual}>Manual</option>
                  <option value={ManagedServiceStartPolicies.onDemand}>On demand</option>
                  <option value={ManagedServiceStartPolicies.externalOnly}>External only</option>
                  <option value={ManagedServiceStartPolicies.disabled}>Disabled</option>
                </select>
              </label>
            </div>

            <div className="ui-managed-services__actions">
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--sm"
                disabled={isLoading || isMutating}
                onClick={() => {
                  const payload = toDefinitionInput(editorState, selectedService);
                  if (editorMode === "create") {
                    onCreateService(payload);
                  } else if (selectedService) {
                    onUpdateService(selectedService.id, payload);
                  }
                  setEditorMode(undefined);
                }}
              >
                {editorMode === "create" ? "Create service" : "Save changes"}
              </button>
            </div>
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
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
                    <span className="ui-badge ui-badge--neutral">{service.source === "builtin" ? "Built-in" : "Custom"}</span>
                    <span className="ui-text-secondary ui-text-small">{service.transport}</span>
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
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Command</span>
                      <span className="ui-meta-value">{selectedService.command ?? "Not configured"}</span>
                    </div>
                    <div className="ui-meta-item">
                      <span className="ui-meta-label">Working directory</span>
                      <span className="ui-meta-value">{selectedService.workingDirectory ?? "Not configured"}</span>
                    </div>
                    <div className="ui-meta-item ui-managed-services__meta-item--full">
                      <span className="ui-meta-label">Last error detail</span>
                      <span className="ui-meta-value">{presenter.presentErrorDetail(selectedService)}</span>
                    </div>
                  </div>

                  <div className="ui-managed-services__actions">
                    <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={!selectedService.canManageLifecycle || isLoading || isMutating} onClick={() => onStart(selectedService.id)}>
                      Start
                    </button>
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={!selectedService.canManageLifecycle || isLoading || isMutating} onClick={() => onStop(selectedService.id)}>
                      Stop
                    </button>
                    <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={!selectedService.canManageLifecycle || isLoading || isMutating} onClick={() => onRestart(selectedService.id)}>
                      Restart
                    </button>
                    <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading || isMutating} onClick={() => onEnsureRunning(selectedService.id)}>
                      Check / ensure
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      disabled={!selectedService.canEdit || isLoading || isMutating}
                      onClick={() => {
                        setEditorMode("edit");
                        setEditorState(createEditorState(selectedService));
                      }}
                    >
                      Edit service
                    </button>
                    {selectedService.canRemove ? (
                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        disabled={isLoading || isMutating}
                        onClick={() => onRemoveService(selectedService.id)}
                      >
                        Remove service
                      </button>
                    ) : null}
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

function presentStreamState(streamState: ManagedServicesPanelProps["streamState"]): string {
  switch (streamState) {
    case "live":
      return "Live monitoring";
    case "reconnecting":
      return "Reconnecting…";
    case "connecting":
      return "Connecting…";
    case "idle":
    default:
      return "Monitoring idle";
  }
}

function createEmptyEditorState(): ServiceEditorState {
  return {
    serviceId: "",
    displayName: "",
    description: "",
    kind: "custom",
    command: "",
    argsText: "",
    workingDirectory: "",
    envText: "",
    baseUrl: "",
    startupTimeoutMs: "20000",
    restartPolicy: ManagedServiceRestartPolicies.never,
    autoStartPolicy: ManagedServiceStartPolicies.manual,
  };
}

function createEditorState(service: ManagedServiceRecord): ServiceEditorState {
  return {
    serviceId: service.id,
    displayName: service.name,
    description: service.description ?? "",
    kind: service.kind,
    command: service.command ?? "",
    argsText: service.args.join(" "),
    workingDirectory: service.workingDirectory ?? "",
    envText: Object.entries(service.environmentVariables).map(([key, value]) => `${key}=${value}`).join("\n"),
    baseUrl: service.baseUrl ?? service.endpointSummary ?? "",
    startupTimeoutMs: String(service.startupTimeoutMs),
    restartPolicy: service.restartPolicy,
    autoStartPolicy: service.startPolicy,
  };
}

function toDefinitionInput(
  state: ServiceEditorState,
  selectedService?: ManagedServiceRecord,
): ManagedServiceDefinitionInput {
  return {
    serviceId: state.serviceId,
    displayName: state.displayName,
    description: state.description,
    kind: selectedService?.kind ?? state.kind,
    command: state.command,
    args: state.argsText.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean),
    workingDirectory: state.workingDirectory,
    environmentVariables: Object.fromEntries(
      state.envText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [key, ...rest] = line.split("=");
          return [key?.trim() ?? "", rest.join("=").trim()];
        }),
    ),
    baseUrl: state.baseUrl,
    startupTimeoutMs: Number(state.startupTimeoutMs),
    restartPolicy: state.restartPolicy,
    autoStartPolicy: state.autoStartPolicy,
  };
}
