import type {
  ManagedServiceDescriptor,
  ManagedServiceKind,
  ManagedServiceStartPolicy,
} from "./interfaces/ManagedServiceTypes";
import { ManagedServiceStartPolicies } from "./interfaces/ManagedServiceTypes";

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

export const ManagedServiceSources = {
  builtin: "builtin",
  custom: "custom",
} as const;

export const ManagedServiceHealthProbeKinds = {
  http: "http",
  none: "none",
} as const;

export type ManagedServiceTransport =
  (typeof ManagedServiceTransports)[keyof typeof ManagedServiceTransports];

export type ManagedServiceRestartPolicy =
  (typeof ManagedServiceRestartPolicies)[keyof typeof ManagedServiceRestartPolicies];

export type ManagedServiceSource =
  (typeof ManagedServiceSources)[keyof typeof ManagedServiceSources];

export type ManagedServiceHealthProbeKind =
  (typeof ManagedServiceHealthProbeKinds)[keyof typeof ManagedServiceHealthProbeKinds];

export interface ManagedServiceHealthProbeDefinition {
  readonly kind: ManagedServiceHealthProbeKind;
  readonly url?: string;
}

export interface ManagedServiceDefinition {
  readonly serviceId: string;
  readonly kind: ManagedServiceKind;
  readonly displayName: string;
  readonly description?: string;
  readonly transport: ManagedServiceTransport;
  readonly source?: ManagedServiceSource;
  readonly baseUrl?: string;
  readonly healthCheckPath?: string;
  readonly healthProbe?: ManagedServiceHealthProbeDefinition;
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

export interface ManagedServiceDefinitionInput {
  readonly serviceId: string;
  readonly kind: ManagedServiceKind;
  readonly displayName: string;
  readonly description?: string;
  readonly transport?: ManagedServiceTransport;
  readonly source?: ManagedServiceSource;
  readonly baseUrl?: string;
  readonly healthCheckPath?: string;
  readonly healthProbe?: ManagedServiceHealthProbeDefinition;
  readonly workingDirectory?: string;
  readonly command?: string;
  readonly args?: ReadonlyArray<string>;
  readonly environmentVariables?: Readonly<Record<string, string>>;
  readonly autoStartPolicy?: ManagedServiceStartPolicy;
  readonly restartPolicy?: ManagedServiceRestartPolicy;
  readonly startupTimeoutMs?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly capabilities?: ReadonlyArray<string>;
}

const DEFAULT_STARTUP_TIMEOUT_MS = 20_000;
const DEFAULT_HEALTH_CHECK_PATH = "/health";
const SERVICE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENVIRONMENT_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function createManagedServiceDefinition(
  definition: ManagedServiceDefinitionInput,
): ManagedServiceDefinition {
  return validateManagedServiceDefinition({
    ...definition,
    transport: definition.transport ?? resolveTransport(definition),
    source: definition.source ?? ManagedServiceSources.custom,
    healthCheckPath: definition.healthCheckPath ?? resolveHealthCheckPath(definition),
    args: definition.args ?? [],
    environmentVariables: definition.environmentVariables ?? {},
    autoStartPolicy: definition.autoStartPolicy ?? ManagedServiceStartPolicies.manual,
    restartPolicy: definition.restartPolicy ?? ManagedServiceRestartPolicies.never,
    startupTimeoutMs: definition.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
    tags: definition.tags ?? [],
    capabilities: definition.capabilities ?? [],
  });
}

export function validateManagedServiceDefinition(
  definition: ManagedServiceDefinition,
): ManagedServiceDefinition {
  const serviceId = requireTrimmedValue(definition.serviceId, "serviceId");
  if (!SERVICE_ID_PATTERN.test(serviceId)) {
    throw new Error(
      `Managed service '${serviceId}' must use lowercase letters, numbers, and hyphen-separated words.`,
    );
  }

  const displayName = requireTrimmedValue(definition.displayName, "displayName");
  const description = normalizeOptionalValue(definition.description);
  const baseUrl = normalizeUrl(definition.baseUrl, `Managed service '${serviceId}' has invalid baseUrl`);
  const healthCheckPath = normalizeOptionalValue(definition.healthCheckPath);
  const workingDirectory = normalizeOptionalValue(definition.workingDirectory);
  const command = normalizeOptionalValue(definition.command);
  const source = definition.source ?? ManagedServiceSources.custom;

  if (!Object.values(ManagedServiceSources).includes(source)) {
    throw new Error(`Managed service '${serviceId}' has unsupported source '${source}'.`);
  }

  if (!Object.values(ManagedServiceTransports).includes(definition.transport)) {
    throw new Error(`Managed service '${serviceId}' has unsupported transport '${definition.transport}'.`);
  }

  if (!Object.values(ManagedServiceRestartPolicies).includes(definition.restartPolicy)) {
    throw new Error(
      `Managed service '${serviceId}' has unsupported restart policy '${definition.restartPolicy}'.`,
    );
  }

  if (healthCheckPath && !healthCheckPath.startsWith("/")) {
    throw new Error(`Managed service '${serviceId}' healthCheckPath must start with '/'.`);
  }

  if ((definition.transport === ManagedServiceTransports.process || definition.transport === ManagedServiceTransports.hybrid) && !command) {
    throw new Error(`Managed service '${serviceId}' requires a command for '${definition.transport}' transport.`);
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
      Object.entries(definition.environmentVariables ?? {}).map(([key, value]) => {
        const normalizedKey = requireTrimmedValue(key, `environmentVariables key for '${serviceId}'`);
        if (!ENVIRONMENT_KEY_PATTERN.test(normalizedKey)) {
          throw new Error(
            `Managed service '${serviceId}' environment variable '${normalizedKey}' must use shell-safe variable naming.`,
          );
        }
        return [normalizedKey, requireTrimmedValue(value, `environmentVariables['${key}']`)];
      }),
    ),
  );

  const healthProbe = validateHealthProbe(serviceId, definition.healthProbe, baseUrl, healthCheckPath);

  return Object.freeze({
    serviceId,
    kind: definition.kind,
    displayName,
    description,
    transport: definition.transport,
    source,
    baseUrl,
    healthCheckPath,
    healthProbe,
    workingDirectory,
    command,
    args,
    environmentVariables,
    autoStartPolicy: definition.autoStartPolicy,
    restartPolicy: definition.restartPolicy,
    startupTimeoutMs: Math.round(definition.startupTimeoutMs),
    tags,
    capabilities,
  } satisfies ManagedServiceDefinition);
}

export function mergeBuiltinManagedServiceDefinition(
  builtinDefinition: ManagedServiceDefinition,
  persistedDefinition: ManagedServiceDefinition | undefined,
): ManagedServiceDefinition {
  if (!persistedDefinition) {
    return validateManagedServiceDefinition({
      ...builtinDefinition,
      source: ManagedServiceSources.builtin,
    });
  }

  if (persistedDefinition.serviceId !== builtinDefinition.serviceId) {
    throw new Error(
      `Managed service '${builtinDefinition.serviceId}' cannot be overridden by '${persistedDefinition.serviceId}'.`,
    );
  }

  return createManagedServiceDefinition({
    serviceId: builtinDefinition.serviceId,
    kind: builtinDefinition.kind,
    source: ManagedServiceSources.builtin,
    displayName: persistedDefinition.displayName || builtinDefinition.displayName,
    description: persistedDefinition.description ?? builtinDefinition.description,
    transport: builtinDefinition.transport,
    baseUrl: persistedDefinition.baseUrl ?? builtinDefinition.baseUrl,
    healthCheckPath: persistedDefinition.healthCheckPath ?? builtinDefinition.healthCheckPath,
    healthProbe: persistedDefinition.healthProbe ?? builtinDefinition.healthProbe,
    workingDirectory: persistedDefinition.workingDirectory ?? builtinDefinition.workingDirectory,
    command: sanitizeBuiltinPythonCommand(persistedDefinition.command) ?? builtinDefinition.command,
    args: builtinDefinition.args,
    environmentVariables: {
      ...builtinDefinition.environmentVariables,
      ...persistedDefinition.environmentVariables,
    },
    autoStartPolicy: persistedDefinition.autoStartPolicy ?? builtinDefinition.autoStartPolicy,
    restartPolicy: builtinDefinition.restartPolicy,
    startupTimeoutMs: persistedDefinition.startupTimeoutMs ?? builtinDefinition.startupTimeoutMs,
    tags: builtinDefinition.tags,
    capabilities: builtinDefinition.capabilities,
  });
}

export function getManagedServiceHealthUrl(definition: ManagedServiceDefinition): string | undefined {
  const explicitProbeUrl = definition.healthProbe?.kind === ManagedServiceHealthProbeKinds.http
    ? normalizeOptionalValue(definition.healthProbe.url)
    : undefined;
  if (explicitProbeUrl) {
    return explicitProbeUrl;
  }

  const baseUrl = normalizeOptionalValue(definition.baseUrl);
  if (!baseUrl) {
    return undefined;
  }

  const healthCheckPath = normalizeOptionalValue(definition.healthCheckPath);
  if (!healthCheckPath) {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}${healthCheckPath}`;
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

function resolveTransport(definition: ManagedServiceDefinitionInput): ManagedServiceTransport {
  if (definition.command?.trim() && definition.baseUrl?.trim()) {
    return ManagedServiceTransports.hybrid;
  }

  if (definition.command?.trim()) {
    return ManagedServiceTransports.process;
  }

  if (definition.baseUrl?.trim() || definition.healthProbe?.url?.trim()) {
    return ManagedServiceTransports.http;
  }

  return ManagedServiceTransports.none;
}

function resolveHealthCheckPath(definition: ManagedServiceDefinitionInput): string | undefined {
  if (definition.healthProbe?.url?.trim()) {
    return undefined;
  }

  return definition.baseUrl?.trim() ? DEFAULT_HEALTH_CHECK_PATH : undefined;
}

function validateHealthProbe(
  serviceId: string,
  probe: ManagedServiceHealthProbeDefinition | undefined,
  baseUrl: string | undefined,
  healthCheckPath: string | undefined,
): ManagedServiceHealthProbeDefinition | undefined {
  const normalizedProbe = probe
    ? Object.freeze({
      kind: probe.kind,
      url: normalizeOptionalValue(probe.url),
    } satisfies ManagedServiceHealthProbeDefinition)
    : undefined;

  if (normalizedProbe) {
    if (!Object.values(ManagedServiceHealthProbeKinds).includes(normalizedProbe.kind)) {
      throw new Error(`Managed service '${serviceId}' has unsupported health probe '${normalizedProbe.kind}'.`);
    }

    if (normalizedProbe.kind === ManagedServiceHealthProbeKinds.http) {
      const url = normalizeUrl(normalizedProbe.url, `Managed service '${serviceId}' has invalid health probe URL`);
      return Object.freeze({
        kind: ManagedServiceHealthProbeKinds.http,
        url,
      });
    }

    return Object.freeze({ kind: ManagedServiceHealthProbeKinds.none });
  }

  const derivedUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}${healthCheckPath ?? ""}`
    : undefined;
  if (!derivedUrl) {
    return undefined;
  }

  return Object.freeze({
    kind: ManagedServiceHealthProbeKinds.http,
    url: derivedUrl,
  });
}

function sanitizeBuiltinPythonCommand(command: string | undefined): string | undefined {
  const normalized = normalizeOptionalValue(command);
  if (!normalized) {
    return undefined;
  }

  const safeCommand = normalized.toLowerCase();
  if (!/^python(?:\d+(?:\.\d+)?)?$/.test(safeCommand)) {
    throw new Error("Built-in Python runtime command must stay within python executables (python, python3, python3.11, etc.).");
  }

  return normalized;
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

function normalizeUrl(value: string | undefined, messagePrefix: string): string | undefined {
  const normalized = normalizeOptionalValue(value);
  if (!normalized) {
    return undefined;
  }

  try {
    return new URL(normalized).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${messagePrefix} '${normalized}'.`);
  }
}
