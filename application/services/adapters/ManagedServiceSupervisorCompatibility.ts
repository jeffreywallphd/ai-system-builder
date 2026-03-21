import type {
  ManagedSupervisorServiceRecord,
  ManagedSupervisorServiceState,
} from "../interfaces/IManagedServiceSupervisorClient";
import type { ManagedServiceDefinition } from "../ManagedServiceDefinition";
import {
  ManagedServiceOwnership,
  ManagedServiceStates,
  type ManagedServiceLogEvent,
  type ManagedServiceStatus,
} from "../interfaces/ManagedServiceTypes";

export function mapSupervisorServiceToManagedServiceStatus(
  definition: ManagedServiceDefinition,
  service: ManagedSupervisorServiceRecord,
): ManagedServiceStatus {
  return Object.freeze({
    serviceId: definition.serviceId,
    kind: definition.kind,
    state: mapSupervisorStateToManagedServiceState(service.state),
    isAvailable: service.state === "healthy",
    ownership: mapSupervisorOwnership(service.ownership),
    startPolicy: definition.autoStartPolicy,
    lastUpdatedAt: service.lastHealthCheckAt ?? service.startedAt ?? new Date().toISOString(),
    detail: service.detail?.trim() || undefined,
  });
}

export function mapSupervisorStateToManagedServiceState(state: ManagedSupervisorServiceState) {
  switch (state) {
    case "healthy":
      return ManagedServiceStates.running;
    case "unhealthy":
      return ManagedServiceStates.degraded;
    case "starting":
      return ManagedServiceStates.starting;
    case "failed":
      return ManagedServiceStates.failed;
    case "stopping":
      return ManagedServiceStates.stopping;
    case "stopped":
      return ManagedServiceStates.stopped;
    case "unavailable":
    default:
      return ManagedServiceStates.unavailable;
  }
}

export function mapSupervisorLogLevelToManagedServiceLogLevel(
  level: ManagedSupervisorServiceRecord["recentLogs"][number]["level"],
): ManagedServiceLogEvent["level"] {
  if (level === "stdout") {
    return "info";
  }

  if (level === "stderr") {
    return "error";
  }

  return level;
}

function mapSupervisorOwnership(ownership: ManagedSupervisorServiceRecord["ownership"]) {
  switch (ownership) {
    case "managed":
      return ManagedServiceOwnership.managed;
    case "external":
      return ManagedServiceOwnership.external;
    case "none":
    default:
      return ManagedServiceOwnership.none;
  }
}
