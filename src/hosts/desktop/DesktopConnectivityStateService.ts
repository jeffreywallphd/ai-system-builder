import {
  OfflineConnectivityStates,
  type OfflineConnectivitySurfaceStateDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import {
  OfflineOperationalEventChannels,
  OfflineOperationalEventTypes,
  type IOfflineOperationalEventSink,
  publishOfflineOperationalEventBestEffort,
} from "@application/common/OfflineOperationalEventPorts";

export const DesktopConnectivityReasonCodes = Object.freeze({
  online: "online",
  trustedSessionUnavailable: "trusted-session-unavailable",
  trustPrerequisitesMissing: "trust-prerequisites-missing",
  transportTransientFailure: "transport-transient-failure",
  transportUnreachable: "transport-unreachable",
  deliberateOfflineMode: "offline-mode-deliberate",
} as const);

export type DesktopConnectivityReasonCode =
  typeof DesktopConnectivityReasonCodes[keyof typeof DesktopConnectivityReasonCodes];

export const DesktopOfflineModeIntents = Object.freeze({
  none: "none",
  automatic: "automatic",
  deliberate: "deliberate",
} as const);

export type DesktopOfflineModeIntent =
  typeof DesktopOfflineModeIntents[keyof typeof DesktopOfflineModeIntents];

export interface DesktopConnectivityObservation {
  readonly transportReachable: boolean;
  readonly transportTransientFailure?: boolean;
  readonly transportDetail?: string;
  readonly trustedSessionAvailable: boolean;
  readonly trustedSessionDetail?: string;
  readonly trustPrerequisitesSatisfied: boolean;
  readonly trustPrerequisitesDetail?: string;
  readonly trustEnforcement: "required" | "optional";
  readonly observedAt?: string;
}

export interface DesktopConnectivityProbeResult {
  readonly transportReachable: boolean;
  readonly transportTransientFailure?: boolean;
  readonly transportDetail?: string;
  readonly trustedSessionAvailable: boolean;
  readonly trustedSessionDetail?: string;
  readonly trustPrerequisitesSatisfied: boolean;
  readonly trustPrerequisitesDetail?: string;
  readonly trustEnforcement: "required" | "optional";
}

export interface DesktopConnectivityProbePort {
  probe(): Promise<DesktopConnectivityProbeResult>;
}

export interface DesktopConnectivityStateServiceOptions {
  readonly now?: () => Date;
  readonly initialState?: OfflineConnectivitySurfaceStateDto;
  readonly eventSink?: IOfflineOperationalEventSink;
  readonly eventContext?: {
    readonly workspaceId?: string;
    readonly actorUserIdentityId?: string;
  };
}

export interface DesktopConnectivityMonitorOptions {
  readonly intervalMs?: number;
}

export interface DesktopConnectivityStateSnapshot extends OfflineConnectivitySurfaceStateDto {
  readonly reasonCode?: DesktopConnectivityReasonCode;
  readonly transportReachable?: boolean;
  readonly trustedSessionAvailable?: boolean;
  readonly trustPrerequisitesSatisfied?: boolean;
  readonly offlineModeIntent?: DesktopOfflineModeIntent;
  readonly trustEnforcement?: "required" | "optional";
}

type DesktopConnectivityListener = (state: DesktopConnectivityStateSnapshot) => void;

const DEFAULT_MONITOR_INTERVAL_MS = 4_000;

export class DesktopConnectivityStateService {
  private readonly now: () => Date;
  private readonly eventSink: IOfflineOperationalEventSink | undefined;
  private readonly eventWorkspaceId: string | undefined;
  private readonly eventActorUserIdentityId: string | undefined;
  private readonly listeners = new Set<DesktopConnectivityListener>();
  private readonly evaluateFromPreviousState: (
    previous: DesktopConnectivityStateSnapshot,
    observation: DesktopConnectivityObservation,
    deliberateOffline: boolean,
    deliberateDetail?: string,
  ) => DesktopConnectivityStateSnapshot;
  private state: DesktopConnectivityStateSnapshot;
  private deliberateOfflineMode = false;
  private deliberateOfflineDetail: string | undefined;
  private monitorTimer: ReturnType<typeof setInterval> | undefined;

  public constructor(options?: DesktopConnectivityStateServiceOptions) {
    this.now = options?.now ?? (() => new Date());
    this.eventSink = options?.eventSink;
    this.eventWorkspaceId = normalizeOptional(options?.eventContext?.workspaceId);
    this.eventActorUserIdentityId = normalizeOptional(options?.eventContext?.actorUserIdentityId);
    this.state = options?.initialState
      ? this.toSnapshot(options.initialState)
      : this.toSnapshot(Object.freeze({
        state: OfflineConnectivityStates.connecting,
        stale: false,
        localModeActive: false,
        lastChangedAt: this.now().toISOString(),
        canQueueOperations: true,
        canResynchronize: false,
      }));
    this.evaluateFromPreviousState = this.defaultEvaluator.bind(this);
  }

  public getState(): DesktopConnectivityStateSnapshot {
    return this.state;
  }

  public subscribe(listener: DesktopConnectivityListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setDeliberateOfflineMode(active: boolean, detail?: string): DesktopConnectivityStateSnapshot {
    this.deliberateOfflineMode = active;
    this.deliberateOfflineDetail = normalizeOptional(detail);

    if (!active) {
      return this.state;
    }

    return this.publish(this.toSnapshot(Object.freeze({
      state: OfflineConnectivityStates.disconnected,
      stale: true,
      localModeActive: true,
      detail: this.deliberateOfflineDetail ?? "Offline local mode enabled deliberately on this desktop host.",
      lastChangedAt: this.now().toISOString(),
      canQueueOperations: true,
      canResynchronize: false,
      reasonCode: DesktopConnectivityReasonCodes.deliberateOfflineMode,
      offlineModeIntent: DesktopOfflineModeIntents.deliberate,
      transportReachable: this.state.transportReachable,
      trustedSessionAvailable: this.state.trustedSessionAvailable,
      trustPrerequisitesSatisfied: this.state.trustPrerequisitesSatisfied,
      trustEnforcement: this.state.trustEnforcement,
    })));
  }

  public observe(observation: DesktopConnectivityObservation): DesktopConnectivityStateSnapshot {
    const next = this.evaluateFromPreviousState(
      this.state,
      observation,
      this.deliberateOfflineMode,
      this.deliberateOfflineDetail,
    );
    return this.publish(next);
  }

  public startMonitoring(
    probePort: DesktopConnectivityProbePort,
    options?: DesktopConnectivityMonitorOptions,
  ): void {
    this.stopMonitoring();
    const intervalMs = Math.max(250, Math.floor(options?.intervalMs ?? DEFAULT_MONITOR_INTERVAL_MS));

    const runProbe = async () => {
      try {
        const observation = await probePort.probe();
        this.observe({
          ...observation,
          observedAt: this.now().toISOString(),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Desktop connectivity probe failed.";
        this.observe({
          transportReachable: false,
          transportTransientFailure: true,
          transportDetail: detail,
          trustedSessionAvailable: this.state.trustedSessionAvailable ?? false,
          trustedSessionDetail: this.state.detail,
          trustPrerequisitesSatisfied: this.state.trustPrerequisitesSatisfied ?? true,
          trustPrerequisitesDetail: this.state.detail,
          trustEnforcement: this.state.trustEnforcement ?? "optional",
          observedAt: this.now().toISOString(),
        });
      }
    };

    void runProbe();
    this.monitorTimer = setInterval(() => {
      void runProbe();
    }, intervalMs);
  }

  public stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  private defaultEvaluator(
    previous: DesktopConnectivityStateSnapshot,
    observation: DesktopConnectivityObservation,
    deliberateOffline: boolean,
    deliberateDetail?: string,
  ): DesktopConnectivityStateSnapshot {
    const observedAt = observation.observedAt ?? this.now().toISOString();

    if (deliberateOffline) {
      return this.toSnapshot(Object.freeze({
        ...previous,
        state: OfflineConnectivityStates.disconnected,
        stale: true,
        localModeActive: true,
        detail: deliberateDetail ?? "Offline local mode enabled deliberately on this desktop host.",
        lastChangedAt: observedAt,
        canQueueOperations: true,
        canResynchronize: false,
        reasonCode: DesktopConnectivityReasonCodes.deliberateOfflineMode,
        offlineModeIntent: DesktopOfflineModeIntents.deliberate,
        transportReachable: observation.transportReachable,
        trustedSessionAvailable: observation.trustedSessionAvailable,
        trustPrerequisitesSatisfied: observation.trustPrerequisitesSatisfied,
        trustEnforcement: observation.trustEnforcement,
      }));
    }

    if (!observation.transportReachable) {
      if (observation.transportTransientFailure) {
        return this.toSnapshot(Object.freeze({
          ...previous,
          state: OfflineConnectivityStates.reconnecting,
          stale: true,
          localModeActive: true,
          detail: observation.transportDetail ?? "Authoritative server connectivity is temporarily degraded; reconnecting.",
          lastChangedAt: observedAt,
          canQueueOperations: true,
          canResynchronize: true,
          reasonCode: DesktopConnectivityReasonCodes.transportTransientFailure,
          offlineModeIntent: DesktopOfflineModeIntents.automatic,
          transportReachable: false,
          trustedSessionAvailable: observation.trustedSessionAvailable,
          trustPrerequisitesSatisfied: observation.trustPrerequisitesSatisfied,
          trustEnforcement: observation.trustEnforcement,
        }));
      }

      return this.toSnapshot(Object.freeze({
        ...previous,
        state: OfflineConnectivityStates.disconnected,
        stale: true,
        localModeActive: true,
        detail: observation.transportDetail ?? "Authoritative server is unreachable from this desktop host.",
        lastChangedAt: observedAt,
        canQueueOperations: true,
        canResynchronize: false,
        reasonCode: DesktopConnectivityReasonCodes.transportUnreachable,
        offlineModeIntent: DesktopOfflineModeIntents.automatic,
        transportReachable: false,
        trustedSessionAvailable: observation.trustedSessionAvailable,
        trustPrerequisitesSatisfied: observation.trustPrerequisitesSatisfied,
        trustEnforcement: observation.trustEnforcement,
      }));
    }

    if (!observation.trustPrerequisitesSatisfied) {
      return this.toSnapshot(Object.freeze({
        ...previous,
        state: OfflineConnectivityStates.degraded,
        stale: true,
        localModeActive: true,
        detail: observation.trustPrerequisitesDetail
          ?? "Trusted transport prerequisites are unavailable for this desktop host.",
        lastChangedAt: observedAt,
        canQueueOperations: false,
        canResynchronize: false,
        reasonCode: DesktopConnectivityReasonCodes.trustPrerequisitesMissing,
        offlineModeIntent: DesktopOfflineModeIntents.automatic,
        transportReachable: true,
        trustedSessionAvailable: observation.trustedSessionAvailable,
        trustPrerequisitesSatisfied: false,
        trustEnforcement: observation.trustEnforcement,
      }));
    }

    if (!observation.trustedSessionAvailable) {
      return this.toSnapshot(Object.freeze({
        ...previous,
        state: OfflineConnectivityStates.degraded,
        stale: true,
        localModeActive: true,
        detail: observation.trustedSessionDetail
          ?? "No active trusted session is available for authoritative resynchronization.",
        lastChangedAt: observedAt,
        canQueueOperations: true,
        canResynchronize: false,
        reasonCode: DesktopConnectivityReasonCodes.trustedSessionUnavailable,
        offlineModeIntent: DesktopOfflineModeIntents.automatic,
        transportReachable: true,
        trustedSessionAvailable: false,
        trustPrerequisitesSatisfied: true,
        trustEnforcement: observation.trustEnforcement,
      }));
    }

    return this.toSnapshot(Object.freeze({
      ...previous,
      state: OfflineConnectivityStates.connected,
      stale: false,
      localModeActive: false,
      detail: undefined,
      lastChangedAt: observedAt,
      canQueueOperations: true,
      canResynchronize: true,
      reasonCode: DesktopConnectivityReasonCodes.online,
      offlineModeIntent: DesktopOfflineModeIntents.none,
      transportReachable: true,
      trustedSessionAvailable: true,
      trustPrerequisitesSatisfied: true,
      trustEnforcement: observation.trustEnforcement,
    }));
  }

  private publish(next: DesktopConnectivityStateSnapshot): DesktopConnectivityStateSnapshot {
    if (this.areEquivalent(this.state, next)) {
      return this.state;
    }

    const previous = this.state;
    this.state = next;
    this.publishConnectivityTransitionEvents(previous, next);
    for (const listener of this.listeners) {
      listener(next);
    }
    return next;
  }

  private publishConnectivityTransitionEvents(
    previous: DesktopConnectivityStateSnapshot,
    next: DesktopConnectivityStateSnapshot,
  ): void {
    const wasOffline = previous.localModeActive;
    const isOffline = next.localModeActive;
    if (wasOffline === isOffline) {
      return;
    }

    const eventType = isOffline
      ? OfflineOperationalEventTypes.offlineEntered
      : OfflineOperationalEventTypes.offlineExited;
    const summary = isOffline
      ? "Desktop host entered offline local mode."
      : "Desktop host exited offline local mode.";
    void publishOfflineOperationalEventBestEffort(this.eventSink, Object.freeze({
      channel: OfflineOperationalEventChannels.operational,
      type: eventType,
      occurredAt: next.lastChangedAt,
      workspaceId: this.eventWorkspaceId,
      actorUserIdentityId: this.eventActorUserIdentityId,
      summary,
      details: Object.freeze({
        previousState: previous.state,
        nextState: next.state,
        reasonCode: next.reasonCode,
        offlineModeIntent: next.offlineModeIntent,
        canResynchronize: next.canResynchronize,
      }),
    }));
  }

  private toSnapshot(state: OfflineConnectivitySurfaceStateDto): DesktopConnectivityStateSnapshot {
    return Object.freeze({ ...state });
  }

  private areEquivalent(
    left: DesktopConnectivityStateSnapshot,
    right: DesktopConnectivityStateSnapshot,
  ): boolean {
    return left.state === right.state
      && left.stale === right.stale
      && left.localModeActive === right.localModeActive
      && left.detail === right.detail
      && left.canQueueOperations === right.canQueueOperations
      && left.canResynchronize === right.canResynchronize
      && left.reasonCode === right.reasonCode
      && left.transportReachable === right.transportReachable
      && left.trustedSessionAvailable === right.trustedSessionAvailable
      && left.trustPrerequisitesSatisfied === right.trustPrerequisitesSatisfied
      && left.offlineModeIntent === right.offlineModeIntent
      && left.trustEnforcement === right.trustEnforcement;
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
