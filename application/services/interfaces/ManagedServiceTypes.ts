export const ManagedServiceKinds = {
  pythonRuntime: "python-runtime",
  custom: "custom",
} as const;

export const ManagedServiceOwnership = {
  external: "external",
  managed: "managed",
  none: "none",
} as const;

export const ManagedServiceStates = {
  unavailable: "unavailable",
  starting: "starting",
  running: "running",
  degraded: "degraded",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
  disabled: "disabled",
} as const;

export const ManagedServiceProvisioningStates = {
  unsupported: "unsupported",
  unprovisioned: "unprovisioned",
  provisioning: "provisioning",
  provisioned: "provisioned",
  provisionFailed: "provision-failed",
} as const;

export const ManagedServiceProvisioningActions = {
  provision: "provision",
  repair: "repair",
  recreateEnvironment: "recreate-environment",
} as const;

export const ManagedServiceStartPolicies = {
  disabled: "disabled",
  externalOnly: "external-only",
  manual: "manual",
  onDemand: "on-demand",
} as const;

export type ManagedServiceKind =
  (typeof ManagedServiceKinds)[keyof typeof ManagedServiceKinds];

export type ManagedServiceOwnership =
  (typeof ManagedServiceOwnership)[keyof typeof ManagedServiceOwnership];

export type ManagedServiceState =
  (typeof ManagedServiceStates)[keyof typeof ManagedServiceStates];

export type ManagedServiceProvisioningState =
  (typeof ManagedServiceProvisioningStates)[keyof typeof ManagedServiceProvisioningStates];

export type ManagedServiceProvisioningAction =
  (typeof ManagedServiceProvisioningActions)[keyof typeof ManagedServiceProvisioningActions];

export type ManagedServiceStartPolicy =
  (typeof ManagedServiceStartPolicies)[keyof typeof ManagedServiceStartPolicies];

export interface ManagedServiceDescriptor {
  readonly id: string;
  readonly kind: ManagedServiceKind;
  readonly name: string;
  readonly description?: string;
  readonly startPolicy: ManagedServiceStartPolicy;
}

export interface ManagedServiceStatus {
  readonly serviceId: string;
  readonly kind: ManagedServiceKind;
  readonly state: ManagedServiceState;
  readonly isAvailable: boolean;
  readonly ownership: ManagedServiceOwnership;
  readonly startPolicy: ManagedServiceStartPolicy;
  readonly lastUpdatedAt: string;
  readonly detail?: string;
}

export interface ManagedServiceLogEvent {
  readonly serviceId: string;
  readonly kind: ManagedServiceKind;
  readonly level: "info" | "success" | "warning" | "error";
  readonly message: string;
  readonly occurredAt: string;
}

export type ManagedServiceStatusListener = (status: ManagedServiceStatus) => void;
export type ManagedServiceLogListener = (event: ManagedServiceLogEvent) => void;
export type ManagedServiceSubscription = () => void;
