import type { AppRuntimeConfig } from "../../src/infrastructure/config/AppRuntimeConfig";
import {
  createDefaultUiSettings,
  createWorkspaceDefaults,
  mergeUiSettings,
  type DeepPartial,
  type UiSettings,
  type WorkspaceDataMode as WorkspaceDataModeValue,
} from "./UiSettings";
import { AutoSaveController } from "../state/AutoSaveController";

export interface UiSettingsStorage {
  load(): DeepPartial<UiSettings> | undefined;
  save(settings: UiSettings): void;
}

export interface UiSettingsState {
  readonly settings: UiSettings;
  readonly isAutoSaving: boolean;
  readonly saveError?: string;
  readonly lastSavedAt?: string;
}

export type UiSettingsStoreListener = (state: UiSettingsState) => void;

export interface UiSettingsStoreOptions {
  readonly config: AppRuntimeConfig;
  readonly storage: UiSettingsStorage;
}

export class UiSettingsStore {
  private readonly defaults: UiSettings;
  private readonly storage: UiSettingsStorage;
  private readonly autoSaveController: AutoSaveController;
  private readonly listeners = new Set<UiSettingsStoreListener>();
  private state: UiSettingsState;

  constructor(options: UiSettingsStoreOptions) {
    this.defaults = createDefaultUiSettings(options.config);
    this.storage = options.storage;
    this.autoSaveController = new AutoSaveController({
      onSave: () => {
        this.persist(this.state.settings);
      },
    });
    this.state = Object.freeze({
      settings: mergeUiSettings(this.defaults, this.storage.load()),
      isAutoSaving: false,
      saveError: undefined,
      lastSavedAt: undefined,
    });
  }

  public getState(): UiSettingsState {
    return this.state;
  }

  public getSettings(): UiSettings {
    return this.state.settings;
  }

  public subscribe(listener: UiSettingsStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public updateSection<K extends keyof UiSettings>(
    section: K,
    patch: DeepPartial<UiSettings[K]>
  ): void {
    const nextSettings = mergeUiSettings(this.defaults, {
      ...this.state.settings,
      [section]: {
        ...this.state.settings[section],
        ...patch,
      },
    });

    this.stage(nextSettings);
  }

  public replace(settings: DeepPartial<UiSettings>): void {
    this.stage(mergeUiSettings(this.defaults, settings));
  }


  public setWorkspaceDataMode(mode: WorkspaceDataModeValue): void {
    const workspaceDefaults = createWorkspaceDefaults(mode);

    this.stage(mergeUiSettings(this.defaults, {
      ...this.state.settings,
      workspace: workspaceDefaults,
      development: {
        ...this.state.settings.development,
        workspaceDataMode: mode,
      },
    }));
  }

  public resetSection<K extends keyof UiSettings>(section: K): void {
    if (section === "workspace") {
      this.stage(mergeUiSettings(this.defaults, {
        ...this.state.settings,
        workspace: createWorkspaceDefaults(this.state.settings.development.workspaceDataMode),
      }));
      return;
    }

    if (section === "development") {
      const development = this.defaults.development;
      this.stage(mergeUiSettings(this.defaults, {
        ...this.state.settings,
        workspace: createWorkspaceDefaults(development.workspaceDataMode),
        development,
      }));
      return;
    }

    this.stage(mergeUiSettings(this.defaults, {
      ...this.state.settings,
      [section]: this.defaults[section],
    }));
  }

  public resetAll(): void {
    this.stage(this.defaults);
  }

  public dispose(): void {
    void this.autoSaveController.flush();
    this.autoSaveController.dispose();
  }

  private persist(settings: UiSettings): void {
    try {
      this.storage.save(settings);
      this.setState({
        isAutoSaving: false,
        settings,
        saveError: undefined,
        lastSavedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.setState({
        isAutoSaving: false,
        settings,
        saveError: error instanceof Error ? error.message : "Unable to save settings.",
      });
    }
  }

  private stage(settings: UiSettings): void {
    this.setState({
      settings,
      isAutoSaving: true,
      saveError: undefined,
    });
    this.autoSaveController.schedule();
  }

  private setState(patch: Partial<UiSettingsState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      settings: patch.settings ?? this.state.settings,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

const storageKey = "ai-loom-studio.ui-settings";

export class LocalStorageUiSettingsStorage implements UiSettingsStorage {
  private readonly key: string;
  private readonly storage?: Pick<Storage, "getItem" | "setItem">;

  constructor(
    key = storageKey,
    storage = typeof window !== "undefined" ? window.localStorage : undefined
  ) {
    this.key = key;
    this.storage = storage;
  }

  public load(): DeepPartial<UiSettings> | undefined {
    const raw = this.storage?.getItem(this.key);

    if (!raw) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as DeepPartial<UiSettings>;
    } catch {
      return undefined;
    }
  }

  public save(settings: UiSettings): void {
    this.storage?.setItem(this.key, JSON.stringify(settings));
  }
}
