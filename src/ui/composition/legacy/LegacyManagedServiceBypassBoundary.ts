import type { IManagedServiceDefinitionRepository } from "@application/services/interfaces/IManagedServiceDefinitionRepository";
import type { IManagedServiceSupervisorClient } from "@application/services/interfaces/IManagedServiceSupervisorClient";
import type { PythonRuntimeConfig } from "@infrastructure/config/PythonRuntimeConfig";
import { LocalStorageManagedServiceDefinitionRepository } from "@infrastructure/browser/services/LocalStorageManagedServiceDefinitionRepository";
import { HttpManagedServiceDefinitionRepository } from "@infrastructure/services/HttpManagedServiceDefinitionRepository";
import {
  HttpManagedServiceSupervisorClient,
  type HttpManagedServiceSupervisorClientOptions,
} from "@infrastructure/services/HttpManagedServiceSupervisorClient";
import {
  ManagedServiceEventStream,
  type ManagedServiceEventStreamOptions,
} from "@ui/services/ManagedServiceEventStream";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface LegacyManagedServiceBypassBoundary {
  readonly isEnabled: boolean;
  readonly migrationNote: string;
  readonly definitionRepository: IManagedServiceDefinitionRepository;
  readonly supervisorClient?: IManagedServiceSupervisorClient;
  readonly eventStream?: ManagedServiceEventStream;
}

export interface ResolveLegacyManagedServiceBypassBoundaryOptions {
  readonly enableLegacyBypass: boolean;
  readonly pythonRuntimeConfig: PythonRuntimeConfig;
  readonly desktopStorage?: StorageLike;
  readonly createSupervisorClient?: (
    options: HttpManagedServiceSupervisorClientOptions,
  ) => IManagedServiceSupervisorClient;
  readonly createEventStream?: (
    options: ManagedServiceEventStreamOptions,
  ) => ManagedServiceEventStream;
}

export function resolveLegacyManagedServiceBypassBoundary(
  options: ResolveLegacyManagedServiceBypassBoundaryOptions,
): LegacyManagedServiceBypassBoundary {
  if (!options.enableLegacyBypass) {
    return Object.freeze({
      isEnabled: false,
      migrationNote:
        "Legacy managed-service supervisor bypass is isolated and disabled outside explicit managed-local runtime mode.",
      definitionRepository: new LocalStorageManagedServiceDefinitionRepository(
        undefined,
        options.desktopStorage,
      ),
    });
  }

  const createSupervisorClient =
    options.createSupervisorClient ??
    ((clientOptions: HttpManagedServiceSupervisorClientOptions) =>
      new HttpManagedServiceSupervisorClient(clientOptions));
  const createEventStream =
    options.createEventStream ??
    ((eventStreamOptions: ManagedServiceEventStreamOptions) =>
      new ManagedServiceEventStream(eventStreamOptions));

  const supervisorClient = createSupervisorClient({
    baseUrl: options.pythonRuntimeConfig.supervisorBaseUrl,
    timeoutMs: options.pythonRuntimeConfig.timeoutMs,
    authToken: options.pythonRuntimeConfig.authToken,
  });

  return Object.freeze({
    isEnabled: true,
    migrationNote:
      "Legacy managed-service supervisor bypass remains temporarily enabled for managed-local runtime until authoritative API mediation is complete.",
    definitionRepository: new HttpManagedServiceDefinitionRepository(
      supervisorClient,
    ),
    supervisorClient,
    eventStream: createEventStream({
      baseUrl: options.pythonRuntimeConfig.supervisorBaseUrl,
    }),
  });
}
