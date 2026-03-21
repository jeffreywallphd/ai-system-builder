import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useUiDependencies } from "../composition/AppProviders";
import { WorkspaceDataMode, type UiSettings } from "../settings/UiSettings";
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { McpStoreState } from "../state/McpStore";
import type { RuntimeConsoleState } from "../state/RuntimeConsoleStore";
import McpRuntimeStatusPanel from "../components/execution/McpRuntimeStatusPanel";

export default function SettingsPage(): JSX.Element {
  const { settingsStore, mcpStore, runtimeConsoleStore } = useUiDependencies();
  const [state, setState] = useState<UiSettingsState>(() => settingsStore.getState());
  const [mcpState, setMcpState] = useState<McpStoreState>(() => mcpStore.getState());
  const [runtimeState, setRuntimeState] = useState<RuntimeConsoleState>(() => runtimeConsoleStore.getState());
  const [expandedAdvancedSections, setExpandedAdvancedSections] = useState<ReadonlyArray<string>>(
    Object.freeze(["runtime", "development"])
  );

  useEffect(() => settingsStore.subscribe(setState), [settingsStore]);
  useEffect(() => mcpStore.subscribe(setMcpState), [mcpStore]);
  useEffect(() => runtimeConsoleStore.subscribe(setRuntimeState), [runtimeConsoleStore]);

  const saveStatus = useMemo(() => {
    if (state.saveError) {
      return state.saveError;
    }

    if (state.isAutoSaving) {
      return "Saving changes to this browser profile…";
    }

    if (!state.lastSavedAt) {
      return "Changes save automatically to this browser profile.";
    }

    return `Saved locally at ${new Date(state.lastSavedAt).toLocaleTimeString()}.`;
  }, [state.isAutoSaving, state.lastSavedAt, state.saveError]);

  const isAdvancedExpanded = (sectionId: string): boolean => expandedAdvancedSections.includes(sectionId);

  const toggleAdvancedSection = (sectionId: string): void => {
    setExpandedAdvancedSections((current) => (
      current.includes(sectionId)
        ? current.filter((item) => item !== sectionId)
        : [...current, sectionId]
    ));
  };

  return (
    <section className="ui-page ui-settings-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Settings</h1>
          <p className="ui-page__subtitle">
            Configure where AI Loom Studio stores shared data, how models are organized,
            and the runtime endpoints the UI should use.
          </p>
        </div>
      </div>

      <div className="ui-card ui-settings-page__status-card">
        <div className="ui-card__body ui-row ui-row--wrap" style={{ justifyContent: "space-between", gap: "var(--space-sm)" }}>
          <div className="ui-stack ui-stack--2xs">
            <strong>Auto-save is enabled</strong>
            <span className="ui-text-secondary ui-text-small">{saveStatus}</span>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={() => settingsStore.resetAll()}
          >
            Restore recommended defaults
          </button>
        </div>
      </div>

      <div className="ui-settings-page__grid">
        <SettingsSection
          title="Workspace Data"
          description="Keep workflow definitions, inputs, and outputs together in a location your team can back up or sync."
          onReset={() => settingsStore.resetSection("workspace")}
        >
          <FolderPathField
            id="settings-workspace-root"
            label="Workspace root"
            hint="Base directory for workflow-data and related folders."
            value={state.settings.workspace.rootDirectory}
            onChange={(value) => settingsStore.updateSection("workspace", { rootDirectory: value })}
          />
          <div className="ui-settings-page__field-grid">
            <FolderPathField
              id="settings-workspace-workflows"
              label="Saved workflows"
              hint="Default folder for saved workflow definitions."
              value={state.settings.workspace.workflowsDirectory}
              onChange={(value) => settingsStore.updateSection("workspace", { workflowsDirectory: value })}
            />
            <FolderPathField
              id="settings-workspace-inputs"
              label="Inputs"
              hint="Place inbound files and source material here by default."
              value={state.settings.workspace.inputsDirectory}
              onChange={(value) => settingsStore.updateSection("workspace", { inputsDirectory: value })}
            />
            <FolderPathField
              id="settings-workspace-outputs"
              label="Outputs"
              hint="Generated exports and run results can be organized here."
              value={state.settings.workspace.outputsDirectory}
              onChange={(value) => settingsStore.updateSection("workspace", { outputsDirectory: value })}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Models & Downloads"
          description="Point AI Loom Studio at a shared model library, then tune remote search and install defaults for repeatable model management."
          onReset={() => settingsStore.resetSection("models")}
        >
          <div className="ui-settings-page__field-grid">
            <FolderPathField
              id="settings-models-install-directory"
              label="Shared model library"
              hint="New model installs use this location immediately."
              value={state.settings.models.installDirectory}
              onChange={(value) => settingsStore.updateSection("models", { installDirectory: value })}
            />
            <NumberField
              id="settings-models-remote-search-limit"
              label="Default remote search size"
              hint="How many remote models to fetch when the browser first loads or clears filters."
              value={state.settings.models.remoteSearchLimit}
              onChange={(value) => settingsStore.updateSection("models", { remoteSearchLimit: value })}
              min={1}
              step={1}
            />
          </div>

          <AdvancedSection
            title="Authentication & install defaults"
            isOpen={isAdvancedExpanded("models")}
            onToggle={() => toggleAdvancedSection("models")}
          >
            <div className="ui-settings-page__field-grid">
              <TextField
                id="settings-models-auth-token"
                label="Hugging Face access token"
                hint="Used when installing gated or private model files from the Models page."
                value={state.settings.models.authToken}
                onChange={(value) => settingsStore.updateSection("models", { authToken: value })}
                placeholder="hf_..."
              />
            </div>

            <CheckboxField
              id="settings-models-verify-downloads"
              label="Verify downloaded model files"
              hint="Keep integrity checks on during installs whenever checksums are available."
              checked={state.settings.models.verifyDownloads}
              onChange={(checked) => settingsStore.updateSection("models", { verifyDownloads: checked })}
            />
            <CheckboxField
              id="settings-models-register-installed"
              label="Register downloaded models automatically"
              hint="Adds newly installed models to the local installed-model catalog after download."
              checked={state.settings.models.registerInstalledModels}
              onChange={(checked) => settingsStore.updateSection("models", { registerInstalledModels: checked })}
            />
            <CheckboxField
              id="settings-models-allow-overwrite"
              label="Allow overwriting existing model files"
              hint="If disabled, installs keep existing files untouched and fail instead of replacing them."
              checked={state.settings.models.allowOverwrite}
              onChange={(checked) => settingsStore.updateSection("models", { allowOverwrite: checked })}
            />
          </AdvancedSection>
        </SettingsSection>

        <SettingsSection
          title="Runtime & Integrations"
          description="Control how the UI connects to the Python runtime that executes workflow tasks."
          onReset={() => settingsStore.resetSection("runtime")}
        >
          <div className="ui-settings-page__field-grid">
            <SelectField
              id="settings-runtime-mode"
              label="Runtime mode"
              hint="Disable the runtime, connect to an external HTTP runtime, or supervise a managed local runtime."
              value={state.settings.runtime.mode}
              onChange={(value) => settingsStore.updateSection("runtime", { mode: value as UiSettings["runtime"]["mode"] })}
              options={[
                { value: "managed-local", label: "Managed local runtime" },
                { value: "external-http", label: "External HTTP runtime" },
                { value: "disabled", label: "Disabled" },
              ]}
            />
            <TextField
              id="settings-runtime-base-url"
              label="Runtime base URL"
              hint="Used on the next app load when runtime mode is enabled."
              value={state.settings.runtime.baseUrl}
              onChange={(value) => settingsStore.updateSection("runtime", { baseUrl: value })}
              placeholder="http://127.0.0.1:8100"
            />
            <TextField
              id="settings-runtime-auth-token"
              label="Runtime bearer token"
              hint="Included with runtime HTTP requests when your Python runtime requires authentication."
              value={state.settings.runtime.authToken}
              onChange={(value) => settingsStore.updateSection("runtime", { authToken: value })}
              placeholder="Optional token"
            />
          </div>

          <McpRuntimeStatusPanel
            status={mcpState.runtimeStatus}
            tools={[]}
            servers={mcpState.configuredServers}
            searchQuery={mcpState.searchQuery}
            isLoading={mcpState.isLoadingConfigured || mcpState.isSearching || mcpState.isMutating}
            error={mcpState.error}
            runtimeAppState={runtimeState.appState}
            runtimeAppStateDetail={runtimeState.appStateDetail}
            isRuntimeUnavailable={runtimeState.appState !== "ready"}
            onSearchChange={(value) => void mcpStore.search({ query: value }).catch(() => undefined)}
            onConnectServer={(serverId, reconnect) => void mcpStore.connect(serverId, reconnect).catch(() => undefined)}
            onDisconnectServer={(serverId) => void mcpStore.disconnect(serverId).catch(() => undefined)}
            onRestartRuntime={() => void runtimeConsoleStore.restartRuntime().catch(() => undefined)}
          />

          <AdvancedSection
            title="Advanced runtime settings"
            isOpen={isAdvancedExpanded("runtime")}
            onToggle={() => toggleAdvancedSection("runtime")}
          >
            <div className="ui-settings-page__field-grid">
              <FolderPathField
                id="settings-runtime-working-directory"
                label="Runtime working directory"
                hint="Where the Python runtime process should start from."
                value={state.settings.runtime.workingDirectory}
                onChange={(value) => settingsStore.updateSection("runtime", { workingDirectory: value })}
              />
              <NumberField
                id="settings-runtime-startup-timeout"
                label="Startup timeout (ms)"
                hint="How long the UI waits for the runtime to become healthy."
                value={state.settings.runtime.startupTimeoutMs}
                onChange={(value) => settingsStore.updateSection("runtime", { startupTimeoutMs: value })}
              />
              <NumberField
                id="settings-runtime-request-timeout"
                label="Request timeout (ms)"
                hint="How long runtime HTTP requests can run before timing out."
                value={state.settings.runtime.requestTimeoutMs}
                onChange={(value) => settingsStore.updateSection("runtime", { requestTimeoutMs: value })}
              />
              <NumberField
                id="settings-runtime-health-poll"
                label="Health poll interval (ms)"
                hint="Polling frequency while the UI waits for the runtime."
                value={state.settings.runtime.healthPollIntervalMs}
                onChange={(value) => settingsStore.updateSection("runtime", { healthPollIntervalMs: value })}
              />
            </div>

            <CheckboxField
              id="settings-runtime-autostart"
              label="Attempt to auto-start the runtime"
              hint="Useful when you want AI Loom Studio to try connecting immediately on launch."
              checked={state.settings.runtime.autoStartEnabled}
              onChange={(checked) => settingsStore.updateSection("runtime", { autoStartEnabled: checked })}
            />
          </AdvancedSection>
        </SettingsSection>

        <SettingsSection
          title="Workflow Authoring"
          description="Set the default editing layout so each workflow opens in the authoring mode your team prefers."
          onReset={() => settingsStore.resetSection("authoring")}
        >
          <div className="ui-settings-page__field-grid">
            <SelectField
              id="settings-authoring-default-view-mode"
              label="Default editor view"
              hint="Choose whether new workflow editor sessions start in canvas or form mode."
              value={state.settings.authoring.defaultWorkflowViewMode}
              onChange={(value) => settingsStore.updateSection("authoring", {
                defaultWorkflowViewMode: value as UiSettings["authoring"]["defaultWorkflowViewMode"],
              })}
              options={[
                { value: "canvas", label: "Canvas" },
                { value: "form", label: "Form" },
              ]}
            />
          </div>

          <CheckboxField
            id="settings-authoring-open-node-palette"
            label="Open the node palette by default"
            hint="Shows the left-side node browser whenever you open the workflow editor."
            checked={state.settings.authoring.openNodePaletteByDefault}
            onChange={(checked) => settingsStore.updateSection("authoring", { openNodePaletteByDefault: checked })}
          />
          <CheckboxField
            id="settings-authoring-open-inspector"
            label="Open the inspector by default"
            hint="Keeps the properties and validation sidebar visible when entering the editor."
            checked={state.settings.authoring.openInspectorByDefault}
            onChange={(checked) => settingsStore.updateSection("authoring", { openInspectorByDefault: checked })}
          />
          <CheckboxField
            id="settings-authoring-open-outputs"
            label="Open workflow outputs by default"
            hint="Useful if you frequently review generated output assets while editing."
            checked={state.settings.authoring.openOutputsByDefault}
            onChange={(checked) => settingsStore.updateSection("authoring", { openOutputsByDefault: checked })}
          />
        </SettingsSection>

        <SettingsSection
          title="Development Tools"
          description="Switch between development and production workspace data folders, then configure optional sync helpers."
          onReset={() => settingsStore.resetSection("development")}
        >
          <SelectField
            id="settings-development-workspace-mode"
            label="Workspace data mode"
            hint="Development uses dev/workflow-data; production uses user/workflow-data and updates the folder paths below automatically."
            value={state.settings.development.workspaceDataMode}
            onChange={(value) => settingsStore.setWorkspaceDataMode(value as WorkspaceDataMode)}
            options={[
              { value: WorkspaceDataMode.development, label: "Development (dev/workflow-data)" },
              { value: WorkspaceDataMode.production, label: "Production (user/workflow-data)" },
            ]}
          />

          <AdvancedSection
            title="Advanced development settings"
            isOpen={isAdvancedExpanded("development")}
            onToggle={() => toggleAdvancedSection("development")}
          >
            <div className="ui-settings-page__field-grid">
              <TextField
                id="settings-development-sync-url"
                label="Dev sync URL"
                hint="If provided, the Sync PC button will call this endpoint."
                value={state.settings.development.devSyncBaseUrl}
                onChange={(value) => settingsStore.updateSection("development", { devSyncBaseUrl: value })}
                placeholder="http://192.168.1.100:8787"
              />
              <TextField
                id="settings-development-sync-token"
                label="Dev sync token"
                hint="Sent as X-Dev-Sync-Token when a sync is triggered."
                value={state.settings.development.devSyncToken}
                onChange={(value) => settingsStore.updateSection("development", { devSyncToken: value })}
                placeholder="Optional token"
              />
            </div>
          </AdvancedSection>
        </SettingsSection>
      </div>
    </section>
  );
}

interface SettingsSectionProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly onReset: () => void;
}

function SettingsSection({
  title,
  description,
  children,
  onReset,
}: SettingsSectionProps): JSX.Element {
  return (
    <section className="ui-card ui-settings-page__section">
      <div className="ui-card__header ui-row ui-row--wrap" style={{ justifyContent: "space-between", gap: "var(--space-sm)" }}>
        <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
          <h2 className="ui-card__title">{title}</h2>
          <p className="ui-card__subtitle">{description}</p>
        </div>
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={onReset}>
          Reset section
        </button>
      </div>
      <div className="ui-card__body ui-stack ui-stack--md">{children}</div>
    </section>
  );
}

interface AdvancedSectionProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

function AdvancedSection({ title, children, isOpen, onToggle }: AdvancedSectionProps): JSX.Element {
  return (
    <div className="ui-settings-page__advanced ui-stack ui-stack--sm">
      <button type="button" className="ui-button ui-button--ghost ui-button--sm ui-settings-page__advanced-toggle" onClick={onToggle}>
        {isOpen ? `Hide ${title}` : `Show ${title}`}
      </button>
      {isOpen ? <div className="ui-settings-page__advanced-panel ui-stack ui-stack--md">{children}</div> : null}
    </div>
  );
}

interface BaseFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
}

interface TextFieldProps extends BaseFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}

function TextField({ id, label, hint, value, onChange, placeholder }: TextFieldProps): JSX.Element {
  return (
    <label className="ui-field ui-stack ui-stack--2xs" htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <span className="ui-field__hint">{hint}</span>
      <input
        id={id}
        className="ui-input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface NumberFieldProps extends BaseFieldProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly step?: number;
}

function NumberField({ id, label, hint, value, onChange, min, step = 1 }: NumberFieldProps): JSX.Element {
  return (
    <label className="ui-field ui-stack ui-stack--2xs" htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <span className="ui-field__hint">{hint}</span>
      <input
        id={id}
        className="ui-input"
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

interface FolderPathFieldProps extends BaseFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function FolderPathField({ id, label, hint, value, onChange }: FolderPathFieldProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pickerError, setPickerError] = useState<string>();

  const openPicker = async (): Promise<void> => {
    setPickerError(undefined);

    const pickerPath = await pickDirectoryPath();

    if (pickerPath) {
      onChange(normalizeDirectoryPath(pickerPath));
      return;
    }

    fileInputRef.current?.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const path = resolveDirectoryPathFromInput(event.currentTarget);

    if (path) {
      onChange(normalizeDirectoryPath(path));
      setPickerError(undefined);
      event.currentTarget.value = "";
      return;
    }

    setPickerError("This browser can open a folder dialog, but it did not expose the full folder path.");
    event.currentTarget.value = "";
  };

  return (
    <div className="ui-field ui-stack ui-stack--2xs">
      <label className="ui-stack ui-stack--2xs" htmlFor={id}>
        <span className="ui-field__label">{label}</span>
        <span className="ui-field__hint">{hint}</span>
      </label>

      <div className="ui-settings-page__folder-picker">
        <input
          id={id}
          className="ui-input"
          type="text"
          value={value}
          readOnly
        />
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => {
            void openPicker();
          }}
        >
          Browse…
        </button>
      </div>

      <input
        ref={(node) => {
          fileInputRef.current = node;
          node?.setAttribute("webkitdirectory", "");
          node?.setAttribute("directory", "");
          node?.setAttribute("multiple", "");
        }}
        className="ui-settings-page__folder-input"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />

      <span className="ui-field__hint">Uses the full selected folder path whenever the host environment exposes it. Folder names alone are not saved.</span>
      {pickerError ? <span className="ui-field__hint">{pickerError}</span> : null}
    </div>
  );
}

async function pickDirectoryPath(): Promise<string | undefined> {
  const picker = globalDirectoryPickerHost.showDirectoryPicker;

  if (typeof picker !== "function") {
    return undefined;
  }

  try {
    const handle = await picker.call(globalDirectoryPickerHost);
    return resolveDirectoryPathFromHandle(handle);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return undefined;
    }

    return undefined;
  }
}

function resolveDirectoryPathFromInput(input: HTMLInputElement): string | undefined {
  const firstFile = input.files?.[0] as (File & { path?: string; webkitRelativePath?: string }) | undefined;

  if (!firstFile) {
    return undefined;
  }

  if (typeof firstFile.path === "string" && firstFile.path.trim().length > 0) {
    return trimTrailingPathSeparator(dirname(firstFile.path.trim()));
  }

  return undefined;
}

function resolveDirectoryPathFromHandle(handle: unknown): string | undefined {
  if (!handle || typeof handle !== "object") {
    return undefined;
  }

  const candidate = handle as { path?: string; name?: string };

  if (typeof candidate.path === "string" && candidate.path.trim().length > 0) {
    return normalizeDirectoryPath(candidate.path);
  }

  return undefined;
}

function normalizeDirectoryPath(value: string): string {
  return trimTrailingPathSeparator(value.trim());
}

function trimTrailingPathSeparator(value: string): string {
  return value.replace(/[\\/]+$/, "") || value;
}

function dirname(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const lastSeparatorIndex = normalized.lastIndexOf("/");

  if (lastSeparatorIndex <= 0) {
    return value;
  }

  return value.slice(0, lastSeparatorIndex);
}

const globalDirectoryPickerHost = globalThis as typeof globalThis & {
  showDirectoryPicker?: () => Promise<unknown>;
};

interface SelectFieldProps extends BaseFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

function SelectField({ id, label, hint, value, onChange, options }: SelectFieldProps): JSX.Element {
  return (
    <label className="ui-field ui-stack ui-stack--2xs" htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <span className="ui-field__hint">{hint}</span>
      <select id={id} className="ui-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface CheckboxFieldProps extends BaseFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

function CheckboxField({ id, label, hint, checked, onChange }: CheckboxFieldProps): JSX.Element {
  return (
    <label className="ui-row ui-row--sm ui-settings-page__checkbox" htmlFor={id}>
      <input id={id} className="ui-checkbox" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="ui-stack ui-stack--2xs">
        <span className="ui-field__label">{label}</span>
        <span className="ui-field__hint">{hint}</span>
      </span>
    </label>
  );
}
