import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it, testDouble } from "../../../../testing/node-test";

import type { LoggingPort } from "../../../../application/ports/logging";
import type { StructuredLogEvent } from "../../../../contracts/logging";
import type { HuggingFaceFetchImplementation } from "../../../../adapters/storage/huggingface";

import { composeServerHost, resolveServerComfyUiInstallRoot } from "../composeServerHost";

describe("composeServerHost", () => {
  it("provides a LoggingPort-backed seam using the real logging adapter", async () => {
    const sink = testDouble.fn();
    const host = composeServerHost({
      logging: {
        verbosity: "verbose",
        level: "debug",
      },
      logSink: sink,
    });

    expectTypeOf(host.loggingPort).toExtend<LoggingPort>();
    expect(host.loggingConfig).toEqual({
      verbosity: "verbose",
      level: "debug",
      includeDiagnostics: undefined,
    });

    const event: StructuredLogEvent = {
      timestamp: "2026-04-14T12:00:00.000Z",
      level: "info",
      verbosity: "normal",
      event: "upload.started",
      message: "Upload started",
      component: "store-artifact-upload-use-case",
      useCase: "store-artifact-upload",
    };

    await host.loggingPort.log(event);

    expect(sink).toHaveBeenCalledOnce();
    const [, emittedEvent] = sink.mock.calls[0] as [string, StructuredLogEvent];
    expect(emittedEvent).toMatchObject({
      event: "upload.started",
      host: "server",
      component: "store-artifact-upload-use-case",
      useCase: "store-artifact-upload",
    });
  });



  it("composes artifact-repo storage with huggingface provider registration", async () => {
    const fetchMock = testDouble.fn(async () => new Response(null, { status: 404 })) as unknown as HuggingFaceFetchImplementation;
    const hubClient = {
      fileExists: testDouble.fn(async () => false),
      uploadFile: testDouble.fn(async () => undefined),
      downloadFile: testDouble.fn(async () => new Response(new Uint8Array([]), { status: 200 })),
    };

    const host = composeServerHost({
      artifactRepo: {
        huggingFaceFetchImplementation: fetchMock,
        huggingFaceHubClient: hubClient,
      },
    });

    const result = await host.artifactRepoStorage.hasArtifactInRepo({
      target: {
        provider: "huggingface",
        repository: "openai/demo-artifacts",
        path: "images/a.png",
      },
    });

    expect(host.artifactRepoStorage).toBeDefined();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected hasArtifactInRepo success result.");
    }
    expect(result.value.exists).toBe(false);
  });

  it("uses updated host token configuration for Hugging Face store operations", async () => {
    const hubClient = {
      fileExists: testDouble.fn(async () => true),
      uploadFile: testDouble.fn(async () => undefined),
      downloadFile: testDouble.fn(async () => new Response(new Uint8Array([1]), { status: 200 })),
    };
    const host = composeServerHost({
      artifactRepo: {
        huggingFaceHubClient: hubClient,
        huggingFaceTokenConfigFilePath: join(tmpdir(), `server-host-token-${Date.now()}.json`),
      },
    });
    host.setHuggingFaceToken("hf_token_updated");
    await host.artifactRepoStorage.storeArtifactInRepo({
      target: {
        provider: "huggingface",
        repository: "openai/demo-artifacts",
        path: "images/a.png",
      },
      content: new Uint8Array([1, 2, 3]),
    });
    const uploadCall = hubClient.uploadFile.mock.calls[0]?.[0] as { accessToken?: string };
    expect(uploadCall.accessToken).toBe("hf_token_updated");
  });

  it("registers server artifact upload routes using a provided app port without creating express", () => {
    const app = {
      post: testDouble.fn(),
      get: testDouble.fn(),
    };

    const host = composeServerHost();

    host.registerApi({
      app,
      storageRootDirectory: "/tmp/server-artifact-upload-test",
    });

    expect(app.post).toHaveBeenCalledTimes(14);
    expect(app.get).toHaveBeenCalledTimes(3);
    const registeredPaths = app.post.mock.calls.map((call) => call[0]);
    expect(registeredPaths).toEqual([
      "/api/artifact/upload",
      "/api/artifact/browse",
      "/api/artifact/read",
      "/api/artifact/content/read",
      "/api/config/huggingface-token",
      "/api/artifact-repo/has",
      "/api/huggingface/namespace/datasets",
      "/api/huggingface/dataset/parquet-files",
      "/api/artifact-repo/store",
      "/api/artifact/publish",
      "/api/artifact/publish/verify",
      "/api/artifact/source/verify",
      "/api/artifact/register-from-repo",
      "/api/artifact/localize-from-repo",
    ]);
    const registeredGetPaths = app.get.mock.calls.map((call) => call[0]);
    expect(registeredGetPaths).toEqual(["/api/artifact/upload/policy", "/api/artifact/media/view", "/api/config/huggingface-token"]);
  });

  it("wires Hugging Face browse use-cases to the dedicated Hugging Face adapter seam", () => {
    const canonicalSourcePath = resolve("modules/hosts/server/composition/composeServerHost.ts");
    const typeScriptPath = fileURLToPath(new URL("../composeServerHost.ts", import.meta.url));
    const sourcePath = existsSync(canonicalSourcePath)
      ? canonicalSourcePath
      : (existsSync(typeScriptPath) ? typeScriptPath : typeScriptPath.replace(/\.ts$/, ".js"));
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("const huggingFaceArtifactRepoStorage = createHuggingFaceArtifactRepoStorageAdapter");
    expect(source).toContain("adapter: huggingFaceArtifactRepoStorage");
    expect(source).toContain("repoBrowser: huggingFaceArtifactRepoStorage");
    expect(source).not.toContain("repoBrowser: artifactRepoStorage");
  });
});

describe("server runtime/comfy root resolution", () => {
  it("defaults ComfyUI install root under server-runtime sibling, not storage root", () => {
    const { installRoot, runtimeRootDirectory, source } = resolveServerComfyUiInstallRoot({
      env: {} as NodeJS.ProcessEnv,
      storageRootDirectory: "/app/server-artifacts",
    });
    expect(runtimeRootDirectory).toBe("/app/server-runtime");
    expect(installRoot).toBe("/app/server-runtime/runtime-installs/comfyui");
    expect(source).toBe("default-server-runtime-root");
  });

  it("uses SERVER_RUNTIME_ROOT when provided", () => {
    const { installRoot, source } = resolveServerComfyUiInstallRoot({
      env: { SERVER_RUNTIME_ROOT: " /tmp/runtime-root " } as NodeJS.ProcessEnv,
      storageRootDirectory: "/app/server-artifacts",
    });
    expect(installRoot).toBe(resolve("/tmp/runtime-root", "runtime-installs", "comfyui"));
    expect(source).toBe("SERVER_RUNTIME_ROOT");
  });

  it("COMFYUI_INSTALL_ROOT overrides exact install root", () => {
    const { installRoot, source } = resolveServerComfyUiInstallRoot({
      env: { SERVER_RUNTIME_ROOT: "/tmp/runtime-root", COMFYUI_INSTALL_ROOT: " /tmp/custom-comfy " } as NodeJS.ProcessEnv,
      storageRootDirectory: "/app/server-artifacts",
    });
    expect(installRoot).toBe(resolve("/tmp/custom-comfy"));
    expect(source).toBe("COMFYUI_INSTALL_ROOT");
  });
});
