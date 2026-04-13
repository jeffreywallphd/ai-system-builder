export class DesktopControlPlaneRuntimeContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesktopControlPlaneRuntimeContractError";
  }
}

export const DesktopControlPlaneHostIdentities = Object.freeze({
  desktopSessionControlPlane: Object.freeze({
    hostId: "host:desktop:session-control-plane",
    transportProtocol: "http",
    surface: "desktop-renderer-loopback",
  }),
});

export type DesktopControlPlaneHostIdentity =
  typeof DesktopControlPlaneHostIdentities[keyof typeof DesktopControlPlaneHostIdentities];

export const DesktopControlPlaneWarmupTriggerSources = Object.freeze({
  explicitLogin: "explicit-login",
  sessionRestore: "session-restore",
  sessionRefresh: "session-refresh",
  featureDemand: "feature-demand",
  unknown: "unknown",
});

export type DesktopControlPlaneWarmupTriggerSource =
  typeof DesktopControlPlaneWarmupTriggerSources[keyof typeof DesktopControlPlaneWarmupTriggerSources];

export const DesktopControlPlaneCapabilityActivationModes = Object.freeze({
  authSuccessWarmup: "auth-success-warmup",
  lazyFeatureDemand: "lazy-feature-demand",
});

export type DesktopControlPlaneCapabilityActivationMode =
  typeof DesktopControlPlaneCapabilityActivationModes[keyof typeof DesktopControlPlaneCapabilityActivationModes];

export const DesktopControlPlaneCapabilityPhases = Object.freeze({
  preLogin: "pre-login",
  warming: "warming",
  ready: "ready",
  failed: "failed",
});

export type DesktopControlPlaneCapabilityPhase =
  typeof DesktopControlPlaneCapabilityPhases[keyof typeof DesktopControlPlaneCapabilityPhases];

export const DesktopControlPlaneTransportPhases = Object.freeze({
  unavailable: "unavailable",
  binding: "binding",
  available: "available",
  failed: "failed",
});

export type DesktopControlPlaneTransportPhase =
  typeof DesktopControlPlaneTransportPhases[keyof typeof DesktopControlPlaneTransportPhases];

export const DesktopControlPlaneRuntimeActivationStates = Object.freeze({
  preLogin: "pre-login",
  warming: "warming",
  ready: "ready",
  failed: "failed",
});

export type DesktopControlPlaneRuntimeActivationState =
  typeof DesktopControlPlaneRuntimeActivationStates[keyof typeof DesktopControlPlaneRuntimeActivationStates];

export const DesktopControlPlaneCapabilityUnavailableReasons = Object.freeze({
  preLogin: "pre-login",
  loggedOut: "logged-out",
  shuttingDown: "shutting-down",
});

export type DesktopControlPlaneCapabilityUnavailableReason =
  typeof DesktopControlPlaneCapabilityUnavailableReasons[keyof typeof DesktopControlPlaneCapabilityUnavailableReasons];

export interface DesktopControlPlaneTransportStatus {
  readonly phase: DesktopControlPlaneTransportPhase;
  readonly updatedAt: string;
  readonly boundAddress?: string;
  readonly boundPort?: number;
  readonly failureMessage?: string;
}

export interface DesktopControlPlaneCapabilityFailure {
  readonly message: string;
  readonly failedAt: string;
  readonly retryable: boolean;
}

export const DesktopControlPlaneActivationStageStates = Object.freeze({
  pending: "pending",
  running: "running",
  ready: "ready",
  blocked: "blocked",
});

export type DesktopControlPlaneActivationStageState =
  typeof DesktopControlPlaneActivationStageStates[keyof typeof DesktopControlPlaneActivationStageStates];

export interface DesktopControlPlaneActivationStageStatus {
  readonly stageId: string;
  readonly state: DesktopControlPlaneActivationStageState;
  readonly updatedAt: string;
  readonly blockingReadiness: boolean;
  readonly detail?: string;
  readonly errorMessage?: string;
}

export interface DesktopControlPlaneRuntimeStatus {
  readonly host: DesktopControlPlaneHostIdentity;
  readonly state: DesktopControlPlaneRuntimeActivationState;
  readonly capabilityPhase: DesktopControlPlaneCapabilityPhase;
  readonly updatedAt: string;
  readonly activationMode?: DesktopControlPlaneCapabilityActivationMode;
  readonly triggerSource?: DesktopControlPlaneWarmupTriggerSource;
  readonly requestedAt?: string;
  readonly unavailableReason?: DesktopControlPlaneCapabilityUnavailableReason;
  readonly failure?: DesktopControlPlaneCapabilityFailure;
  readonly transport: DesktopControlPlaneTransportStatus;
  readonly activationStages?: ReadonlyArray<DesktopControlPlaneActivationStageStatus>;
}

export const DesktopControlPlaneLifecycleTracks = Object.freeze({
  transport: "transport",
  capability: "capability",
});

export type DesktopControlPlaneLifecycleTrack =
  typeof DesktopControlPlaneLifecycleTracks[keyof typeof DesktopControlPlaneLifecycleTracks];

export interface DesktopControlPlaneLifecycleTransition {
  readonly hostId: string;
  readonly track: DesktopControlPlaneLifecycleTrack;
  readonly from: DesktopControlPlaneTransportPhase | DesktopControlPlaneCapabilityPhase;
  readonly to: DesktopControlPlaneTransportPhase | DesktopControlPlaneCapabilityPhase;
  readonly occurredAt: string;
  readonly reason: string;
}

const AllowedCapabilityTransitions = new Map<DesktopControlPlaneCapabilityPhase, ReadonlyArray<DesktopControlPlaneCapabilityPhase>>([
  [DesktopControlPlaneCapabilityPhases.preLogin, [DesktopControlPlaneCapabilityPhases.warming, DesktopControlPlaneCapabilityPhases.failed]],
  [DesktopControlPlaneCapabilityPhases.warming, [DesktopControlPlaneCapabilityPhases.ready, DesktopControlPlaneCapabilityPhases.failed, DesktopControlPlaneCapabilityPhases.preLogin]],
  [DesktopControlPlaneCapabilityPhases.ready, [DesktopControlPlaneCapabilityPhases.warming, DesktopControlPlaneCapabilityPhases.preLogin, DesktopControlPlaneCapabilityPhases.failed]],
  [DesktopControlPlaneCapabilityPhases.failed, [DesktopControlPlaneCapabilityPhases.warming, DesktopControlPlaneCapabilityPhases.preLogin]],
]);

const AllowedTransportTransitions = new Map<DesktopControlPlaneTransportPhase, ReadonlyArray<DesktopControlPlaneTransportPhase>>([
  [DesktopControlPlaneTransportPhases.unavailable, [DesktopControlPlaneTransportPhases.binding, DesktopControlPlaneTransportPhases.failed]],
  [DesktopControlPlaneTransportPhases.binding, [DesktopControlPlaneTransportPhases.available, DesktopControlPlaneTransportPhases.failed]],
  [DesktopControlPlaneTransportPhases.available, [DesktopControlPlaneTransportPhases.binding, DesktopControlPlaneTransportPhases.unavailable, DesktopControlPlaneTransportPhases.failed]],
  [DesktopControlPlaneTransportPhases.failed, [DesktopControlPlaneTransportPhases.binding, DesktopControlPlaneTransportPhases.unavailable]],
]);

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new DesktopControlPlaneRuntimeContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new DesktopControlPlaneRuntimeContractError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function assertAllowedTransition<TPhase extends string>(input: {
  readonly track: DesktopControlPlaneLifecycleTrack;
  readonly from: TPhase;
  readonly to: TPhase;
  readonly transitions: ReadonlyMap<TPhase, ReadonlyArray<TPhase>>;
}): void {
  const allowed = input.transitions.get(input.from) ?? [];
  if (!allowed.includes(input.to)) {
    throw new DesktopControlPlaneRuntimeContractError(
      `Desktop control-plane ${input.track} cannot transition from '${input.from}' to '${input.to}'.`,
    );
  }
}

export function transitionDesktopControlPlaneCapabilityPhase(input: {
  readonly hostId: string;
  readonly from: DesktopControlPlaneCapabilityPhase;
  readonly to: DesktopControlPlaneCapabilityPhase;
  readonly occurredAt?: string;
  readonly reason: string;
}): DesktopControlPlaneLifecycleTransition {
  assertAllowedTransition({
    track: DesktopControlPlaneLifecycleTracks.capability,
    from: input.from,
    to: input.to,
    transitions: AllowedCapabilityTransitions,
  });

  return Object.freeze({
    hostId: normalizeRequired(input.hostId, "Desktop control-plane lifecycle hostId"),
    track: DesktopControlPlaneLifecycleTracks.capability,
    from: input.from,
    to: input.to,
    occurredAt: normalizeIsoTimestamp(input.occurredAt ?? new Date().toISOString(), "Desktop control-plane lifecycle occurredAt"),
    reason: normalizeRequired(input.reason, "Desktop control-plane lifecycle reason"),
  });
}

export function transitionDesktopControlPlaneTransportPhase(input: {
  readonly hostId: string;
  readonly from: DesktopControlPlaneTransportPhase;
  readonly to: DesktopControlPlaneTransportPhase;
  readonly occurredAt?: string;
  readonly reason: string;
}): DesktopControlPlaneLifecycleTransition {
  assertAllowedTransition({
    track: DesktopControlPlaneLifecycleTracks.transport,
    from: input.from,
    to: input.to,
    transitions: AllowedTransportTransitions,
  });

  return Object.freeze({
    hostId: normalizeRequired(input.hostId, "Desktop control-plane lifecycle hostId"),
    track: DesktopControlPlaneLifecycleTracks.transport,
    from: input.from,
    to: input.to,
    occurredAt: normalizeIsoTimestamp(input.occurredAt ?? new Date().toISOString(), "Desktop control-plane lifecycle occurredAt"),
    reason: normalizeRequired(input.reason, "Desktop control-plane lifecycle reason"),
  });
}

export function resolveDesktopControlPlaneRuntimeActivationState(
  capabilityPhase: DesktopControlPlaneCapabilityPhase,
): DesktopControlPlaneRuntimeActivationState {
  if (capabilityPhase === DesktopControlPlaneCapabilityPhases.preLogin) {
    return DesktopControlPlaneRuntimeActivationStates.preLogin;
  }
  if (capabilityPhase === DesktopControlPlaneCapabilityPhases.warming) {
    return DesktopControlPlaneRuntimeActivationStates.warming;
  }
  if (capabilityPhase === DesktopControlPlaneCapabilityPhases.failed) {
    return DesktopControlPlaneRuntimeActivationStates.failed;
  }
  return DesktopControlPlaneRuntimeActivationStates.ready;
}

export function isDesktopControlPlaneRuntimeReady(
  status: Pick<DesktopControlPlaneRuntimeStatus, "capabilityPhase">,
): boolean {
  return status.capabilityPhase === DesktopControlPlaneCapabilityPhases.ready;
}

export function createDesktopControlPlaneRuntimeStatus(input?: {
  readonly host?: DesktopControlPlaneHostIdentity;
  readonly capabilityPhase?: DesktopControlPlaneCapabilityPhase;
  readonly transportPhase?: DesktopControlPlaneTransportPhase;
  readonly updatedAt?: string;
}): DesktopControlPlaneRuntimeStatus {
  const updatedAt = normalizeIsoTimestamp(input?.updatedAt ?? new Date().toISOString(), "Desktop control-plane updatedAt");
  const capabilityPhase = input?.capabilityPhase ?? DesktopControlPlaneCapabilityPhases.preLogin;
  const transportPhase = input?.transportPhase ?? DesktopControlPlaneTransportPhases.unavailable;

  return Object.freeze({
    host: input?.host ?? DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state: resolveDesktopControlPlaneRuntimeActivationState(capabilityPhase),
    capabilityPhase,
    updatedAt,
    unavailableReason: capabilityPhase === DesktopControlPlaneCapabilityPhases.preLogin
      ? DesktopControlPlaneCapabilityUnavailableReasons.preLogin
      : undefined,
    transport: Object.freeze({
      phase: transportPhase,
      updatedAt,
    }),
  });
}
