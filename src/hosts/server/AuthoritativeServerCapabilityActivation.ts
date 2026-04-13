import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";

export const AuthoritativeServerCapabilityActivationStates = Object.freeze({
  pending: "pending",
  available: "available",
});

export type AuthoritativeServerCapabilityActivationState =
  typeof AuthoritativeServerCapabilityActivationStates[keyof typeof AuthoritativeServerCapabilityActivationStates];

export const AuthoritativeServerCapabilityIds = Object.freeze({
  identityBootstrap: "identity-bootstrap",
  deferredRuntimeFeatures: "deferred-runtime-features",
});

export type AuthoritativeServerCapabilityId =
  typeof AuthoritativeServerCapabilityIds[keyof typeof AuthoritativeServerCapabilityIds];

export interface AuthoritativeServerCapabilityRegistration {
  readonly capabilityId: string;
  readonly description: string;
  readonly routeFamilyIds: ReadonlyArray<string>;
  readonly initialState: AuthoritativeServerCapabilityActivationState;
}

export interface AuthoritativeServerCapabilityStateSnapshot {
  readonly capabilityId: string;
  readonly description: string;
  readonly routeFamilyIds: ReadonlyArray<string>;
  readonly state: AuthoritativeServerCapabilityActivationState;
  readonly activatedAt?: string;
}

export interface AuthoritativeServerCapabilityActivationTransition {
  readonly capabilityId: string;
  readonly from: AuthoritativeServerCapabilityActivationState;
  readonly to: AuthoritativeServerCapabilityActivationState;
  readonly occurredAt: string;
  readonly reason: string;
}

export interface AuthoritativeServerRouteFamilyAvailability {
  readonly routeFamilyId: string;
  readonly capabilityId?: string;
  readonly state?: AuthoritativeServerCapabilityActivationState;
  readonly runtimeLifecycle?: AuthoritativeServerRouteFamilyRuntimeLifecycleSnapshot;
  readonly available: boolean;
}

export interface AuthoritativeServerRouteFamilyRuntimeLifecycleSnapshot {
  readonly capabilityPhase: string;
  readonly transportPhase?: string;
  readonly activationMode?: string;
  readonly triggerSource?: string;
  readonly unavailableReason?: string;
  readonly hasFailure?: boolean;
  readonly failureRetryable?: boolean;
  readonly activationStages?: ReadonlyArray<AuthoritativeServerRuntimeActivationStageSnapshot>;
}

export interface AuthoritativeServerRuntimeActivationStageSnapshot {
  readonly stageId: string;
  readonly state: string;
  readonly blockingReadiness: boolean;
  readonly detail?: string;
  readonly errorMessage?: string;
}

export interface AuthoritativeServerCapabilityActivationSnapshot {
  readonly capturedAt: string;
  readonly capabilities: ReadonlyArray<AuthoritativeServerCapabilityStateSnapshot>;
  readonly routeFamilyAvailability: Readonly<Record<string, boolean>>;
  readonly transitions: ReadonlyArray<AuthoritativeServerCapabilityActivationTransition>;
}

export interface AuthoritativeServerCapabilityActivationRequest {
  readonly capabilityIds: ReadonlyArray<string>;
  readonly reason: string;
  readonly activatedAt?: string;
}

type CapabilityRecord = {
  readonly registration: AuthoritativeServerCapabilityRegistration;
  state: AuthoritativeServerCapabilityActivationState;
  activatedAt?: string;
};

type ActivationClock = {
  readonly nowIsoString: () => string;
};

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

export interface AuthoritativeServerCapabilityActivationService {
  readonly activateCapabilities: (
    request: AuthoritativeServerCapabilityActivationRequest,
  ) => AuthoritativeServerCapabilityActivationSnapshot;
  readonly getSnapshot: () => AuthoritativeServerCapabilityActivationSnapshot;
  readonly isRouteFamilyAvailable: (routeFamilyId: string) => boolean;
  readonly resolveRouteFamilyAvailability: (routeFamilyId: string) => AuthoritativeServerRouteFamilyAvailability;
}

export function createAuthoritativeServerCapabilityActivationService(input: {
  readonly registrations: ReadonlyArray<AuthoritativeServerCapabilityRegistration>;
  readonly clock?: ActivationClock;
  readonly onTransition?: (transition: AuthoritativeServerCapabilityActivationTransition) => void;
}): AuthoritativeServerCapabilityActivationService {
  const clock = input.clock ?? { nowIsoString: () => new Date().toISOString() };
  const records = new Map<string, CapabilityRecord>();
  const routeFamilyToCapability = new Map<string, string>();
  const transitions: AuthoritativeServerCapabilityActivationTransition[] = [];

  for (const registrationInput of input.registrations) {
    const capabilityId = normalizeRequired(
      registrationInput.capabilityId,
      "Authoritative capability registration capabilityId",
    );
    if (records.has(capabilityId)) {
      throw new Error(`Authoritative capability registration '${capabilityId}' must be unique.`);
    }
    if (!Object.values(AuthoritativeServerCapabilityActivationStates).includes(registrationInput.initialState)) {
      throw new Error(
        `Authoritative capability registration '${capabilityId}' has invalid initial state '${String(registrationInput.initialState)}'.`,
      );
    }
    const routeFamilyIds = Array.from(new Set(
      registrationInput.routeFamilyIds
        .map((routeFamilyId) => normalizeRequired(routeFamilyId, `Authoritative capability '${capabilityId}' routeFamilyId`)),
    )).sort();
    const registration: AuthoritativeServerCapabilityRegistration = Object.freeze({
      capabilityId,
      description: normalizeRequired(
        registrationInput.description,
        `Authoritative capability '${capabilityId}' description`,
      ),
      routeFamilyIds: Object.freeze(routeFamilyIds),
      initialState: registrationInput.initialState,
    });
    for (const routeFamilyId of registration.routeFamilyIds) {
      const existingCapabilityId = routeFamilyToCapability.get(routeFamilyId);
      if (existingCapabilityId) {
        throw new Error(
          `Route family '${routeFamilyId}' cannot be registered to both '${existingCapabilityId}' and '${capabilityId}'.`,
        );
      }
      routeFamilyToCapability.set(routeFamilyId, capabilityId);
    }
    records.set(capabilityId, {
      registration,
      state: registration.initialState,
      activatedAt: registration.initialState === AuthoritativeServerCapabilityActivationStates.available
        ? clock.nowIsoString()
        : undefined,
    });
  }

  if (records.size < 1) {
    throw new Error("At least one authoritative capability registration is required.");
  }

  const buildSnapshot = (capturedAt: string): AuthoritativeServerCapabilityActivationSnapshot => {
    const capabilities = [...records.values()]
      .sort((a, b) => a.registration.capabilityId.localeCompare(b.registration.capabilityId))
      .map((record) => Object.freeze({
        capabilityId: record.registration.capabilityId,
        description: record.registration.description,
        routeFamilyIds: record.registration.routeFamilyIds,
        state: record.state,
        activatedAt: record.activatedAt,
      } satisfies AuthoritativeServerCapabilityStateSnapshot));
    const routeFamilyAvailabilityEntries = [...routeFamilyToCapability.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((routeFamilyId) => {
        const capabilityId = routeFamilyToCapability.get(routeFamilyId) as string;
        const capabilityRecord = records.get(capabilityId) as CapabilityRecord;
        return [routeFamilyId, capabilityRecord.state === AuthoritativeServerCapabilityActivationStates.available] as const;
      });
    return Object.freeze({
      capturedAt,
      capabilities: Object.freeze(capabilities),
      routeFamilyAvailability: Object.freeze(Object.fromEntries(routeFamilyAvailabilityEntries)),
      transitions: Object.freeze([...transitions]),
    });
  };

  return Object.freeze({
    activateCapabilities(request) {
      const capabilityIds = Array.from(
        new Set(
          request.capabilityIds.map((capabilityId) => normalizeRequired(capabilityId, "Authoritative capability activation capabilityId")),
        ),
      ).sort();
      const occurredAt = normalizeIsoTimestamp(
        request.activatedAt ?? clock.nowIsoString(),
        "Authoritative capability activation occurredAt",
      );
      const reason = normalizeRequired(request.reason, "Authoritative capability activation reason");
      for (const capabilityId of capabilityIds) {
        const record = records.get(capabilityId);
        if (!record) {
          throw new Error(`Authoritative capability '${capabilityId}' is not registered.`);
        }
        if (record.state === AuthoritativeServerCapabilityActivationStates.available) {
          continue;
        }
        const transition: AuthoritativeServerCapabilityActivationTransition = Object.freeze({
          capabilityId,
          from: record.state,
          to: AuthoritativeServerCapabilityActivationStates.available,
          occurredAt,
          reason,
        });
        record.state = AuthoritativeServerCapabilityActivationStates.available;
        record.activatedAt = occurredAt;
        transitions.push(transition);
        input.onTransition?.(transition);
      }
      return buildSnapshot(occurredAt);
    },
    getSnapshot() {
      return buildSnapshot(clock.nowIsoString());
    },
    isRouteFamilyAvailable(routeFamilyId) {
      const normalizedRouteFamilyId = normalizeRequired(routeFamilyId, "Route family id");
      const capabilityId = routeFamilyToCapability.get(normalizedRouteFamilyId);
      if (!capabilityId) {
        return true;
      }
      return records.get(capabilityId)?.state === AuthoritativeServerCapabilityActivationStates.available;
    },
    resolveRouteFamilyAvailability(routeFamilyId) {
      const normalizedRouteFamilyId = normalizeRequired(routeFamilyId, "Route family id");
      const capabilityId = routeFamilyToCapability.get(normalizedRouteFamilyId);
      if (!capabilityId) {
        return Object.freeze({
          routeFamilyId: normalizedRouteFamilyId,
          available: true,
        } satisfies AuthoritativeServerRouteFamilyAvailability);
      }
      const capability = records.get(capabilityId) as CapabilityRecord;
      return Object.freeze({
        routeFamilyId: normalizedRouteFamilyId,
        capabilityId,
        state: capability.state,
        available: capability.state === AuthoritativeServerCapabilityActivationStates.available,
      } satisfies AuthoritativeServerRouteFamilyAvailability);
    },
  });
}

export function createDefaultAuthoritativeServerCapabilityActivationService(input: {
  readonly routeRegistrationPlan: AuthoritativeApiRouteRegistrationPlan;
  readonly clock?: ActivationClock;
  readonly onTransition?: (transition: AuthoritativeServerCapabilityActivationTransition) => void;
}): AuthoritativeServerCapabilityActivationService {
  const routeFamilyIds = input.routeRegistrationPlan.registeredRouteFamilies
    .map((family) => family.routeFamilyId)
    .sort((a, b) => a.localeCompare(b));
  const identityRouteFamilyIds = routeFamilyIds.filter((routeFamilyId) => routeFamilyId === "identity-auth");
  const deferredRouteFamilyIds = routeFamilyIds.filter((routeFamilyId) => routeFamilyId !== "identity-auth");

  return createAuthoritativeServerCapabilityActivationService({
    registrations: Object.freeze([
      Object.freeze({
        capabilityId: AuthoritativeServerCapabilityIds.identityBootstrap,
        description: "Identity and trusted-session bootstrap routes that remain available pre-login.",
        routeFamilyIds: identityRouteFamilyIds,
        initialState: AuthoritativeServerCapabilityActivationStates.available,
      } satisfies AuthoritativeServerCapabilityRegistration),
      Object.freeze({
        capabilityId: AuthoritativeServerCapabilityIds.deferredRuntimeFeatures,
        description: "Deferred runtime route families activated after authenticated warmup.",
        routeFamilyIds: deferredRouteFamilyIds,
        initialState: AuthoritativeServerCapabilityActivationStates.pending,
      } satisfies AuthoritativeServerCapabilityRegistration),
    ]),
    clock: input.clock,
    onTransition: input.onTransition,
  });
}
