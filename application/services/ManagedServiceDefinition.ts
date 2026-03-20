import type {
  ManagedServiceDescriptor,
  ManagedServiceKind,
  ManagedServiceStartPolicy,
} from "./interfaces/ManagedServiceTypes";

export const ManagedServiceTransports = {
  http: "http",
  process: "process",
  hybrid: "hybrid",
  none: "none",
} as const;

export const ManagedServiceRestartPolicies = {
  never: "never",
  onFailure: "on-failure",
  always: "always",
} as const;

export type ManagedServiceTransport =
  (typeof ManagedServiceTransports)[keyof typeof ManagedServiceTransports];

export type ManagedServiceRestartPolicy =
  (typeof ManagedServiceRestartPolicies)[keyof typeof ManagedServiceRestartPolicies];

export interface ManagedServiceDefinition {
  readonly serviceId: string;
  readonly kind: ManagedServiceKind;
  readonly displayName: string;
  readonly description?: string;
  readonly transport: ManagedServiceTransport;
  readonly baseUrl?: string;
  readonly healthCheckPath?: string;
  readonly workingDirectory?: string;
  readonly command?: string;
  readonly args: ReadonlyArray<string>;
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly autoStartPolicy: ManagedServiceStartPolicy;
  readonly restartPolicy: ManagedServiceRestartPolicy;
  readonly startupTimeoutMs: number;
  readonly tags: ReadonlyArray<string>;
  readonly capabilities: ReadonlyArray<string>;
}

export function validateManagedServiceDefinition(
  definition: ManagedServiceDefinition,
): ManagedServiceDefinition {
  const serviceId = requireTrimmedValue(definition.serviceId, "serviceId");
  const displayName = requireTrimmedValue(definition.displayName, "displayName");
  const description = normalizeOptionalValue(definition.description);
  const baseUrl = normalizeOptionalValue(definition.baseUrl);
  const healthCheckPath = normalizeOptionalValue(definition.healthCheckPath);
  const workingDirectory = normalizeOptionalValue(definition.workingDirectory);
  const command = normalizeOptionalValue(definition.command);

  if (!Object.values(ManagedServiceTransports).includes(definition.transport)) {
    throw new Error(`Managed service '${serviceId}' has unsupported transport '${definition.transport}'.`);
  }

  if (!Object.values(ManagedServiceRestartPolicies).includes(definition.restartPolicy)) {
    throw new Error(
      `Managed service '${serviceId}' has unsupported restart policy '${definition.restartPolicy}'.`,
    );
  }

  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Managed service '${serviceId}' has invalid baseUrl '${baseUrl}'.`);
    }
  }

  if (healthCheckPath && !healthCheckPath.startsWith("/")) {
    throw new Error(`Managed service '${serviceId}' healthCheckPath must start with '/'.`);
  }

  if (!Number.isFinite(definition.startupTimeoutMs) || definition.startupTimeoutMs <= 0) {
    throw new Error(`Managed service '${serviceId}' startupTimeoutMs must be greater than zero.`);
  }

  const args = Object.freeze(
    (definition.args ?? []).map((arg, index) => requireTrimmedValue(arg, `args[${index}]`)),
  );
  const tags = Object.freeze(
    (definition.tags ?? []).map((tag, index) => requireTrimmedValue(tag, `tags[${index}]`)),
  );
  const capabilities = Object.freeze(
    (definition.capabilities ?? []).map((capability, index) =>
      requireTrimmedValue(capability, `capabilities[${index}]`),
    ),
  );

  const environmentVariables = Object.freeze(
    Object.fromEntries(
      Object.entries(definition.environmentVariables ?? {}).map(([key, value]) => [
        requireTrimmedValue(key, `environmentVariables key for '${serviceId}'`),
        requireTrimmedValue(value, `environmentVariables['${key}']`),
      ]),
    ),
  );

  return Object.freeze({
    serviceId,
    kind: definition.kind,
    displayName,
    description,
    transport: definition.transport,
    baseUrl,
    healthCheckPath,
    workingDirectory,
    command,
    args,
    environmentVariables,
    autoStartPolicy: definition.autoStartPolicy,
    restartPolicy: definition.restartPolicy,
    startupTimeoutMs: definition.startupTimeoutMs,
    tags,
    capabilities,
  } satisfies ManagedServiceDefinition);
}

export function toManagedServiceDescriptor(
  definition: ManagedServiceDefinition,
): ManagedServiceDescriptor {
  return Object.freeze({
    id: definition.serviceId,
    kind: definition.kind,
    name: definition.displayName,
    description: definition.description,
    startPolicy: definition.autoStartPolicy,
  });
}

function requireTrimmedValue(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Managed service ${fieldName} is required.`);
  }
  return normalized;
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
