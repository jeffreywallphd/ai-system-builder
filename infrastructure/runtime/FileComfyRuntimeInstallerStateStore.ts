import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ComfyRuntimeInstallerPersistedStateSchema,
  type ComfyRuntimeInstallerPersistedState,
  type ComfyRuntimeInstallerStateLoadResult,
  type IComfyRuntimeInstallerStateStore,
} from "../../application/runtime/ComfyRuntimeInstallerStateContract";

const DEFAULT_STATE_FILENAME = ".ai-loom-comfy-installer-state.json";

export interface FileComfyRuntimeInstallerStateStoreOptions {
  readonly stateFilename?: string;
}

export class FileComfyRuntimeInstallerStateStore implements IComfyRuntimeInstallerStateStore {
  private readonly stateFilename: string;

  public constructor(options: FileComfyRuntimeInstallerStateStoreOptions = {}) {
    this.stateFilename = options.stateFilename?.trim() || DEFAULT_STATE_FILENAME;
  }

  public async load(input: {
    readonly installDirectory: string;
  }): Promise<ComfyRuntimeInstallerStateLoadResult> {
    const statePath = this.resolveStatePath(input.installDirectory);
    if (!existsSync(statePath)) {
      return Object.freeze({
        diagnostics: Object.freeze([]),
      });
    }

    try {
      const raw = JSON.parse(readFileSync(statePath, "utf8")) as unknown;
      const parsed = ComfyRuntimeInstallerPersistedStateSchema.parse(raw);
      return Object.freeze({
        state: Object.freeze({
          ...parsed,
          phases: Object.freeze(parsed.phases),
          diagnostics: Object.freeze({
            ...parsed.diagnostics,
            statePath,
          }),
        }),
        diagnostics: Object.freeze([]),
      });
    } catch (error) {
      return Object.freeze({
        diagnostics: Object.freeze([Object.freeze({
          code: "installer-state-read-failed",
          severity: "warning",
          message: error instanceof Error ? error.message : "Unable to read persisted Comfy installer state.",
          phase: "repository",
          metadata: Object.freeze({
            statePath,
          }),
        })]),
      });
    }
  }

  public async save(state: ComfyRuntimeInstallerPersistedState): Promise<void> {
    const statePath = this.resolveStatePath(state.installDirectory);
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private resolveStatePath(installDirectory: string): string {
    return path.join(path.resolve(installDirectory), this.stateFilename);
  }
}
