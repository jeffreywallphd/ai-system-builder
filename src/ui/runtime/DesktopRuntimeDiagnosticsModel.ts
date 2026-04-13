import {
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginActivationStageIds,
  type DesktopPostLoginActivationStageStatus,
  type DesktopPostLoginRuntimeStatus,
} from "../../../electron/shared/DesktopContracts";
import {
  RuntimeAvailabilityBlockingDependencyCategories,
  type RuntimeAvailabilityBlockingDependencyCategory,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";

export interface DesktopRuntimeTransitionTimestamp {
  readonly key: string;
  readonly label: string;
  readonly occurredAt: string;
}

export interface DesktopRuntimeDiagnosticsSnapshot {
  readonly lifecycleState: DesktopPostLoginRuntimeStatus["state"];
  readonly capabilityPhase: DesktopPostLoginRuntimeStatus["capabilityPhase"];
  readonly transportPhase: DesktopPostLoginRuntimeStatus["transport"]["phase"];
  readonly blockingDependencyCategory: RuntimeAvailabilityBlockingDependencyCategory;
  readonly blockingActivationStageId?: string;
  readonly blockingActivationStageState?: string;
  readonly blockingActivationStageDetail?: string;
  readonly recentTransitionTimestamps: ReadonlyArray<DesktopRuntimeTransitionTimestamp>;
}

export function resolveRuntimeBlockingActivationStage(
  status: DesktopPostLoginRuntimeStatus,
): DesktopPostLoginActivationStageStatus | undefined {
  return status.activationStages?.find((stage) => (
    stage.blockingReadiness && stage.state !== "ready"
  ));
}

export function resolveDesktopRuntimeBlockingDependencyCategory(
  status: DesktopPostLoginRuntimeStatus,
): RuntimeAvailabilityBlockingDependencyCategory {
  const transportPhase = status.transport.phase;
  if (
    transportPhase === DesktopControlPlaneTransportPhases.binding
    || transportPhase === DesktopControlPlaneTransportPhases.unavailable
    || transportPhase === DesktopControlPlaneTransportPhases.failed
  ) {
    return RuntimeAvailabilityBlockingDependencyCategories.controlPlaneTransport;
  }

  if (
    status.state === "pre-login"
    || status.unavailableReason === "pre-login"
    || status.unavailableReason === "logged-out"
  ) {
    return RuntimeAvailabilityBlockingDependencyCategories.authentication;
  }

  if (status.state === "failed") {
    const blockingStage = resolveRuntimeBlockingActivationStage(status);
    if (blockingStage?.stageId === DesktopPostLoginActivationStageIds.serviceSupervisorStartup) {
      return RuntimeAvailabilityBlockingDependencyCategories.runtimeSupervisor;
    }
    if (status.failure?.message.toLowerCase().includes("supervisor")) {
      return RuntimeAvailabilityBlockingDependencyCategories.runtimeSupervisor;
    }
    return RuntimeAvailabilityBlockingDependencyCategories.capabilityActivation;
  }

  if (status.state === "warming") {
    return RuntimeAvailabilityBlockingDependencyCategories.capabilityActivation;
  }

  return RuntimeAvailabilityBlockingDependencyCategories.unknown;
}

export function buildDesktopRuntimeDiagnosticsSnapshot(
  status: DesktopPostLoginRuntimeStatus | undefined,
): DesktopRuntimeDiagnosticsSnapshot | undefined {
  if (!status) {
    return undefined;
  }

  const blockingStage = resolveRuntimeBlockingActivationStage(status);
  return Object.freeze({
    lifecycleState: status.state,
    capabilityPhase: status.capabilityPhase,
    transportPhase: status.transport.phase,
    blockingDependencyCategory: resolveDesktopRuntimeBlockingDependencyCategory(status),
    blockingActivationStageId: blockingStage?.stageId,
    blockingActivationStageState: blockingStage?.state,
    blockingActivationStageDetail: blockingStage?.detail ?? blockingStage?.errorMessage,
    recentTransitionTimestamps: collectRecentTransitionTimestamps(status),
  });
}

export function collectRecentTransitionTimestamps(
  status: DesktopPostLoginRuntimeStatus,
): ReadonlyArray<DesktopRuntimeTransitionTimestamp> {
  const transitions: DesktopRuntimeTransitionTimestamp[] = [];
  transitions.push({
    key: "lifecycle.updated",
    label: "Lifecycle status updated",
    occurredAt: status.updatedAt,
  });
  transitions.push({
    key: "transport.updated",
    label: `Transport status updated (${status.transport.phase})`,
    occurredAt: status.transport.updatedAt,
  });
  if (status.requestedAt) {
    transitions.push({
      key: "warmup.requested",
      label: `Warmup requested (${status.triggerSource ?? "unknown"})`,
      occurredAt: status.requestedAt,
    });
  }
  if (status.failure?.failedAt) {
    transitions.push({
      key: "runtime.failed",
      label: "Runtime failure recorded",
      occurredAt: status.failure.failedAt,
    });
  }
  for (const stage of status.activationStages ?? []) {
    transitions.push({
      key: `stage.${stage.stageId}`,
      label: `Activation stage ${stage.stageId} -> ${stage.state}`,
      occurredAt: stage.updatedAt,
    });
  }

  return Object.freeze(
    transitions
      .filter((entry) => Number.isFinite(Date.parse(entry.occurredAt)))
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, 8),
  );
}
