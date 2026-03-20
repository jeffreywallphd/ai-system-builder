import type { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { PythonRuntimeMode, type PythonRuntimeMode as PythonRuntimeModeValue } from "../../infrastructure/config/PythonRuntimeMode";
import type { WorkflowViewMode } from "../state/WorkflowViewMode";

export const WorkspaceDataMode = {
  development: "development",
  production: "production",
} as const;

export type WorkspaceDataMode = (typeof WorkspaceDataMode)[keyof typeof WorkspaceDataMode];

export interface WorkspaceSettings {
  readonly rootDirectory: string;
  readonly workflowsDirectory: string;
  readonly inputsDirectory: string;
  readonly outputsDirectory: string;
}

export interface ModelLibrarySettings {
  readonly installDirectory: string;
  readonly remoteSearchLimit: number;
  readonly authToken: string;
  readonly verifyDownloads: boolean;
  readonly registerInstalledModels: boolean;
  readonly allowOverwrite: boolean;
}

export interface RuntimeSettings {
  readonly mode: PythonRuntimeModeValue;
  readonly baseUrl: string;
  readonly authToken: string;
  readonly workingDirectory: string;
  readonly requestTimeoutMs: number;
  readonly startupTimeoutMs: number;
  readonly healthPollIntervalMs: number;
  readonly autoStartEnabled: boolean;
}

export interface AuthoringSettings {
  readonly defaultWorkflowViewMode: WorkflowViewMode;
  readonly openNodePaletteByDefault: boolean;
  readonly openInspectorByDefault: boolean;
  readonly openOutputsByDefault: boolean;
}

export interface DevelopmentSettings {
  readonly workspaceDataMode: WorkspaceDataMode;
  readonly devSyncBaseUrl: string;
  readonly devSyncToken: string;
}

export interface UiSettings {
  readonly workspace: WorkspaceSettings;
  readonly models: ModelLibrarySettings;
  readonly runtime: RuntimeSettings;
  readonly authoring: AuthoringSettings;
  readonly development: DevelopmentSettings;
}

export type DeepPartial<T> = {
  readonly [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function resolveDefaultRuntimeWorkingDirectory(): string {
  if (typeof window !== "undefined") {
    return "python-runtime";
  }

  const processLike = typeof globalThis !== "undefined"
    ? (globalThis as typeof globalThis & { process?: { cwd?: () => string } }).process
    : undefined;
  const cwd = typeof processLike?.cwd === "function"
    ? processLike.cwd()
    : ".";
  return `${cwd}/python-runtime`;
}

export function createWorkspaceDefaults(mode: WorkspaceDataMode): WorkspaceSettings {
  const workspaceRoot = mode === WorkspaceDataMode.production
    ? "user/workflow-data"
    : "dev/workflow-data";

  return Object.freeze({
    rootDirectory: workspaceRoot,
    workflowsDirectory: `${workspaceRoot}/workflows`,
    inputsDirectory: `${workspaceRoot}/inputs`,
    outputsDirectory: `${workspaceRoot}/outputs`,
  });
}

export function createDefaultUiSettings(config: AppRuntimeConfig): UiSettings {
  const workspaceDataMode = config.isProductionMode
    ? WorkspaceDataMode.production
    : WorkspaceDataMode.development;

  return Object.freeze({
    workspace: createWorkspaceDefaults(workspaceDataMode),
    models: Object.freeze({
      installDirectory: config.modelInstallDirectory,
      remoteSearchLimit: 16,
      authToken: "",
      verifyDownloads: true,
      registerInstalledModels: true,
      allowOverwrite: false,
    }),
    runtime: Object.freeze({
      mode: PythonRuntimeMode.localHttp,
      baseUrl: "http://127.0.0.1:8000",
      authToken: "",
      workingDirectory: resolveDefaultRuntimeWorkingDirectory(),
      requestTimeoutMs: 15_000,
      startupTimeoutMs: 20_000,
      healthPollIntervalMs: 500,
      autoStartEnabled: true,
    }),
    authoring: Object.freeze({
      defaultWorkflowViewMode: "canvas",
      openNodePaletteByDefault: false,
      openInspectorByDefault: false,
      openOutputsByDefault: false,
    }),
    development: Object.freeze({
      workspaceDataMode,
      devSyncBaseUrl: config.devSyncBaseUrl ?? "",
      devSyncToken: config.devSyncToken ?? "",
    }),
  });
}

export function mergeUiSettings(
  defaults: UiSettings,
  overrides?: DeepPartial<UiSettings>
): UiSettings {
  const workspaceDataMode = normalizeWorkspaceDataMode(
    overrides?.development?.workspaceDataMode,
    defaults.development.workspaceDataMode
  );
  const defaultWorkspace = createWorkspaceDefaults(workspaceDataMode);

  return Object.freeze({
    workspace: Object.freeze({
      rootDirectory: normalizeDirectory(
        overrides?.workspace?.rootDirectory,
        defaultWorkspace.rootDirectory
      ),
      workflowsDirectory: normalizeDirectory(
        overrides?.workspace?.workflowsDirectory,
        defaultWorkspace.workflowsDirectory
      ),
      inputsDirectory: normalizeDirectory(
        overrides?.workspace?.inputsDirectory,
        defaultWorkspace.inputsDirectory
      ),
      outputsDirectory: normalizeDirectory(
        overrides?.workspace?.outputsDirectory,
        defaultWorkspace.outputsDirectory
      ),
    }),
    models: Object.freeze({
      installDirectory: normalizeDirectory(
        overrides?.models?.installDirectory,
        defaults.models.installDirectory
      ),
      remoteSearchLimit: normalizePositiveNumber(
        overrides?.models?.remoteSearchLimit,
        defaults.models.remoteSearchLimit
      ),
      authToken: normalizeString(
        overrides?.models?.authToken,
        defaults.models.authToken
      ),
      verifyDownloads: overrides?.models?.verifyDownloads ?? defaults.models.verifyDownloads,
      registerInstalledModels:
        overrides?.models?.registerInstalledModels ?? defaults.models.registerInstalledModels,
      allowOverwrite: overrides?.models?.allowOverwrite ?? defaults.models.allowOverwrite,
    }),
    runtime: Object.freeze({
      mode: normalizeRuntimeMode(overrides?.runtime?.mode, defaults.runtime.mode),
      baseUrl: normalizeString(overrides?.runtime?.baseUrl, defaults.runtime.baseUrl),
      authToken: normalizeString(overrides?.runtime?.authToken, defaults.runtime.authToken),
      workingDirectory: normalizeDirectory(
        overrides?.runtime?.workingDirectory,
        defaults.runtime.workingDirectory
      ),
      requestTimeoutMs: normalizePositiveNumber(
        overrides?.runtime?.requestTimeoutMs,
        defaults.runtime.requestTimeoutMs
      ),
      startupTimeoutMs: normalizePositiveNumber(
        overrides?.runtime?.startupTimeoutMs,
        defaults.runtime.startupTimeoutMs
      ),
      healthPollIntervalMs: normalizePositiveNumber(
        overrides?.runtime?.healthPollIntervalMs,
        defaults.runtime.healthPollIntervalMs
      ),
      autoStartEnabled: overrides?.runtime?.autoStartEnabled ?? defaults.runtime.autoStartEnabled,
    }),
    authoring: Object.freeze({
      defaultWorkflowViewMode: normalizeWorkflowViewMode(
        overrides?.authoring?.defaultWorkflowViewMode,
        defaults.authoring.defaultWorkflowViewMode
      ),
      openNodePaletteByDefault:
        overrides?.authoring?.openNodePaletteByDefault ?? defaults.authoring.openNodePaletteByDefault,
      openInspectorByDefault:
        overrides?.authoring?.openInspectorByDefault ?? defaults.authoring.openInspectorByDefault,
      openOutputsByDefault:
        overrides?.authoring?.openOutputsByDefault ?? defaults.authoring.openOutputsByDefault,
    }),
    development: Object.freeze({
      workspaceDataMode,
      devSyncBaseUrl: normalizeString(
        overrides?.development?.devSyncBaseUrl,
        defaults.development.devSyncBaseUrl
      ),
      devSyncToken: normalizeString(
        overrides?.development?.devSyncToken,
        defaults.development.devSyncToken
      ),
    }),
  });
}

function normalizeDirectory(value: unknown, fallback: string): string {
  return normalizeString(value, fallback);
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return fallback;
}

function normalizeRuntimeMode(
  value: unknown,
  fallback: PythonRuntimeModeValue
): PythonRuntimeModeValue {
  if (value === PythonRuntimeMode.disabled || value === PythonRuntimeMode.localHttp) {
    return value;
  }

  return fallback;
}

function normalizeWorkspaceDataMode(
  value: unknown,
  fallback: WorkspaceDataMode
): WorkspaceDataMode {
  if (value === WorkspaceDataMode.development || value === WorkspaceDataMode.production) {
    return value;
  }

  return fallback;
}

function normalizeWorkflowViewMode(
  value: unknown,
  fallback: WorkflowViewMode
): WorkflowViewMode {
  if (value === "canvas" || value === "form") {
    return value;
  }

  return fallback;
}
