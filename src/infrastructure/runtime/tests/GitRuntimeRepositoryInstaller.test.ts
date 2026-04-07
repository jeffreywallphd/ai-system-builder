import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { RuntimeRepositoryInstallerKinds } from "@application/runtime/RuntimeRepositoryInstallerContract";
import {
  GitRuntimeRepositoryInstaller,
  type GitCommandRunner,
} from "../GitRuntimeRepositoryInstaller";

interface MutableGitResponse {
  readonly match: (args: ReadonlyArray<string>) => boolean;
  readonly run: (args: ReadonlyArray<string>) => { readonly exitCode: number; readonly stdout?: string; readonly stderr?: string };
}

class RecordingGitRunner implements GitCommandRunner {
  public readonly commands: Array<ReadonlyArray<string>> = [];

  public constructor(private readonly handlers: ReadonlyArray<MutableGitResponse>) {}

  public async run(command: string, args: ReadonlyArray<string>): Promise<{
    command: string;
    args: ReadonlyArray<string>;
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    this.commands.push([command, ...args]);
    for (const handler of this.handlers) {
      if (!handler.match(args)) {
        continue;
      }
      const response = handler.run(args);
      return Object.freeze({
        command,
        args: Object.freeze([...args]),
        exitCode: response.exitCode,
        stdout: response.stdout ?? "",
        stderr: response.stderr ?? "",
      });
    }

    return Object.freeze({
      command,
      args: Object.freeze([...args]),
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  }
}

let tempDirectory: string;

beforeEach(() => {
  tempDirectory = mkdtempSync(path.join(os.tmpdir(), "git-runtime-installer-"));
});

afterEach(() => {
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe("GitRuntimeRepositoryInstaller", () => {
  it("installs into a deterministic location and writes install metadata", async () => {
    let cloneTarget = "";
    const runner = new RecordingGitRunner([
      {
        match: (args) => args[0] === "clone",
        run: (args) => {
          cloneTarget = args[args.length - 1]!;
          mkdirSync(path.join(cloneTarget, ".git"), { recursive: true });
          return { exitCode: 0 };
        },
      },
      {
        match: (args) => args.includes("rev-parse"),
        run: () => ({ exitCode: 0, stdout: "abc123\n" }),
      },
    ]);
    const installer = new GitRuntimeRepositoryInstaller({
      commandRunner: runner,
      now: () => new Date("2026-04-03T00:00:00.000Z"),
    });

    const firstLocation = installer.resolveInstallLocation({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision: "main",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
    });
    const secondLocation = installer.resolveInstallLocation({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision: "main",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
    });
    expect(firstLocation.installDirectory).toBe(secondLocation.installDirectory);

    const result = await installer.install({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        requestedRevision: "main",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
      allowRecovery: true,
      metadata: { shared: true },
    });

    expect(result.success).toBeTrue();
    expect(result.operation).toBe("installed");
    expect(result.installed?.resolvedRevision).toBe("abc123");
    expect(result.recoveredFromPartial).toBeFalse();
    expect(existsSync(path.join(result.installed!.installLocation.installDirectory, ".git"))).toBeTrue();
    expect(cloneTarget.endsWith(".staging-")).toBeFalse();
    const metadataPath = path.join(result.installed!.installLocation.installDirectory, ".ai-loom-runtime-repository-install.json");
    const persisted = JSON.parse(readFileSync(metadataPath, "utf8")) as { resolvedRevision: string };
    expect(persisted.resolvedRevision).toBe("abc123");
  });

  it("recovers partial installs safely when rerun after interruption", async () => {
    const runner = new RecordingGitRunner([
      {
        match: (args) => args[0] === "clone",
        run: (args) => {
          const cloneTarget = args[args.length - 1]!;
          mkdirSync(path.join(cloneTarget, ".git"), { recursive: true });
          return { exitCode: 0 };
        },
      },
      {
        match: (args) => args.includes("rev-parse"),
        run: () => ({ exitCode: 0, stdout: "recover123\n" }),
      },
    ]);
    const installer = new GitRuntimeRepositoryInstaller({ commandRunner: runner });

    const location = installer.resolveInstallLocation({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
    });
    mkdirSync(location.installDirectory, { recursive: true });
    writeFileSync(path.join(location.installDirectory, "INTERRUPTED"), "partial", "utf8");

    const result = await installer.install({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
      allowRecovery: true,
      metadata: {},
    });

    expect(result.success).toBeTrue();
    expect(result.recoveredFromPartial).toBeTrue();
    expect(existsSync(path.join(location.installDirectory, ".git"))).toBeTrue();
    expect(existsSync(path.join(location.installDirectory, "INTERRUPTED"))).toBeFalse();
  });

  it("updates repositories with fetch and pull and reports revision changes", async () => {
    let revParseCount = 0;
    const runner = new RecordingGitRunner([
      {
        match: (args) => args.includes("rev-parse"),
        run: () => {
          revParseCount += 1;
          return { exitCode: 0, stdout: revParseCount === 1 ? "oldrev\n" : "newrev\n" };
        },
      },
      {
        match: (args) => args.includes("fetch"),
        run: () => ({ exitCode: 0 }),
      },
      {
        match: (args) => args.includes("pull"),
        run: () => ({ exitCode: 0 }),
      },
    ]);
    const installer = new GitRuntimeRepositoryInstaller({ commandRunner: runner });
    const location = installer.resolveInstallLocation({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
    });
    mkdirSync(path.join(location.installDirectory, ".git"), { recursive: true });

    const result = await installer.update({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
      metadata: {},
    });

    expect(result.success).toBeTrue();
    expect(result.operation).toBe("updated");
    expect(result.beforeRevision).toBe("oldrev");
    expect(result.afterRevision).toBe("newrev");
    expect(runner.commands.some((command) => command.includes("fetch"))).toBeTrue();
    expect(runner.commands.some((command) => command.includes("pull"))).toBeTrue();
  });

  it("surfaces validation issues when revision expectations do not match", async () => {
    const runner = new RecordingGitRunner([
      {
        match: (args) => args.includes("rev-parse"),
        run: () => ({ exitCode: 0, stdout: "actualrev\n" }),
      },
      {
        match: (args) => args.includes("config"),
        run: () => ({ exitCode: 0, stdout: "https://github.com/comfyanonymous/ComfyUI.git\n" }),
      },
    ]);
    const installer = new GitRuntimeRepositoryInstaller({ commandRunner: runner });
    const location = installer.resolveInstallLocation({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
    });
    mkdirSync(path.join(location.installDirectory, ".git"), { recursive: true });

    const validation = await installer.validate({
      runtimeDependencyId: "runtime:comfyui",
      installerKind: RuntimeRepositoryInstallerKinds.git,
      source: {
        repositoryKind: "git",
        repositoryUri: "https://github.com/comfyanonymous/ComfyUI.git",
        metadata: {},
      },
      targetRootDirectory: tempDirectory,
      expectedRevision: "expectedrev",
    });

    expect(validation.valid).toBeFalse();
    expect(validation.issues.some((issue) => issue.code === "revision-mismatch")).toBeTrue();
  });
});

