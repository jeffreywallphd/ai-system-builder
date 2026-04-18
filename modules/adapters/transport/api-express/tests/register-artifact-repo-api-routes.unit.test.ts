import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  registerArtifactRepoApiRoutes,
  type ArtifactRepoExpressRoutePort,
} from "../artifact-repo/registerArtifactRepoApiRoutes";

describe("registerArtifactRepoApiRoutes", () => {
  it("registers has/store routes and delegates to focused repo-storage use cases", async () => {
    const handlers = new Map<string, Parameters<ArtifactRepoExpressRoutePort["post"]>[1]>();
    const app: ArtifactRepoExpressRoutePort = {
      post: testDouble.fn((routePath, handler) => {
        handlers.set(routePath, handler);
      }),
    };

    const hasArtifactInRepoUseCase = {
      execute: testDouble.fn(async () => ({ ok: true, value: { exists: true } })),
    };
    const storeArtifactInRepoUseCase = {
      execute: testDouble.fn(async () => ({
        ok: true,
        value: {
          descriptor: {
            target: {
              provider: "huggingface",
              repository: "openai/demo",
              path: "artifacts/a.bin",
            },
            sizeBytes: 3,
          },
        },
      })),
    };
    const publishArtifactToRepoUseCase = {
      execute: testDouble.fn(async () => ({
        ok: true,
        value: {
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
            revision: "main",
            locator: "openai/demo/artifacts/a.bin",
          },
          verification: {
            exists: true,
            verifiedAt: "2026-04-17T00:00:00.000Z",
          },
        },
      })),
    };
    const verifyPublishedArtifactBackingUseCase = {
      execute: testDouble.fn(async () => ({
        ok: true,
        value: {
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
            revision: "main",
            locator: "openai/demo/artifacts/a.bin",
          },
          verification: {
            exists: true,
            verifiedAt: "2026-04-17T00:00:00.000Z",
          },
        },
      })),
    };
    const registerArtifactFromRepoUseCase = {
      execute: testDouble.fn(async () => ({
        ok: true,
        value: {
          artifactId: "artifacts/20260418000000-import001",
          backing: {
            role: "imported-source",
            target: {
              provider: "huggingface",
              repository: "openai/demo",
              path: "artifacts/a.bin",
              revision: "main",
              locator: "openai/demo/artifacts/a.bin",
            },
            verification: {
              exists: true,
              verifiedAt: "2026-04-17T00:00:00.000Z",
            },
          },
        },
      })),
    };
    const localizeArtifactFromRepoUseCase = {
      execute: testDouble.fn(async () => ({
        ok: true,
        value: {
          artifactId: "artifacts/20260418000000-local01",
          localObject: {
            key: "artifacts/20260418000000-local01",
            mediaType: "image/png",
            sizeBytes: 3,
          },
          source: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
            revision: "main",
            locator: "openai/demo/artifacts/a.bin",
          },
          localizedAt: "2026-04-18T00:00:00.000Z",
        },
      })),
    };

    registerArtifactRepoApiRoutes({
      app,
      hasArtifactInRepoUseCase,
      storeArtifactInRepoUseCase,
      publishArtifactToRepoUseCase,
      verifyPublishedArtifactBackingUseCase,
      registerArtifactFromRepoUseCase,
      localizeArtifactFromRepoUseCase,
    });

    expect(app.post).toHaveBeenCalledTimes(6);
    expect(handlers.has("/api/artifact-repo/has")).toBe(true);
    expect(handlers.has("/api/artifact-repo/store")).toBe(true);
    expect(handlers.has("/api/artifact/publish")).toBe(true);
    expect(handlers.has("/api/artifact/publish/verify")).toBe(true);
    expect(handlers.has("/api/artifact/register-from-repo")).toBe(true);
    expect(handlers.has("/api/artifact/localize-from-repo")).toBe(true);

    const response = {
      status: testDouble.fn(() => response),
      json: testDouble.fn(),
    };

    await handlers.get("/api/artifact-repo/has")?.(
      {
        body: {
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
          },
        },
        headers: {},
      },
      response,
    );

    await handlers.get("/api/artifact-repo/store")?.(
      {
        body: {
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
          },
          contentBase64: Buffer.from([1, 2, 3]).toString("base64"),
        },
        headers: {},
      },
      response,
    );

    expect(hasArtifactInRepoUseCase.execute).toHaveBeenCalledWith(
      {
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          revision: undefined,
          path: "artifacts/a.bin",
        },
      },
      { requestId: undefined, correlationId: undefined },
    );
    expect(storeArtifactInRepoUseCase.execute).toHaveBeenCalled();
    await handlers.get("/api/artifact/publish")?.(
      {
        body: {
          artifactId: "uploads/a.bin",
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
          },
        },
        headers: {},
      },
      response,
    );

    expect(publishArtifactToRepoUseCase.execute).toHaveBeenCalledWith({
      artifactId: "uploads/a.bin",
      target: {
        provider: "huggingface",
        repository: "openai/demo",
        revision: undefined,
        path: "artifacts/a.bin",
      },
      mediaType: undefined,
    });
    expect(response.status).toHaveBeenCalledWith(200);

    await handlers.get("/api/artifact/localize-from-repo")?.(
      {
        body: {
          artifactId: "artifacts/20260418000000-local01",
        },
        headers: {},
      },
      response,
    );
    expect(localizeArtifactFromRepoUseCase.execute).toHaveBeenCalledWith({
      artifactId: "artifacts/20260418000000-local01",
    });
  });

  it("returns validation error envelope for invalid store payload", async () => {
    const handlers = new Map<string, Parameters<ArtifactRepoExpressRoutePort["post"]>[1]>();
    const app: ArtifactRepoExpressRoutePort = {
      post: testDouble.fn((routePath, handler) => {
        handlers.set(routePath, handler);
      }),
    };

    registerArtifactRepoApiRoutes({
      app,
      hasArtifactInRepoUseCase: { execute: testDouble.fn() },
      storeArtifactInRepoUseCase: { execute: testDouble.fn() },
      publishArtifactToRepoUseCase: { execute: testDouble.fn() },
      verifyPublishedArtifactBackingUseCase: { execute: testDouble.fn() },
      registerArtifactFromRepoUseCase: { execute: testDouble.fn() },
      localizeArtifactFromRepoUseCase: { execute: testDouble.fn() },
    });

    const response = {
      status: testDouble.fn(() => response),
      json: testDouble.fn(),
    };

    await handlers.get("/api/artifact-repo/store")?.(
      {
        body: {
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "artifacts/a.bin",
          },
          contentBase64: "",
        },
        headers: {},
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    const body = (response.json as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0];
    expect(body).toMatchObject({
      ok: false,
      operation: "artifact.repo.store",
      error: {
        code: "validation",
      },
    });
  });

  it("returns validation error envelope for invalid publish payload", async () => {
    const handlers = new Map<string, Parameters<ArtifactRepoExpressRoutePort["post"]>[1]>();
    const app: ArtifactRepoExpressRoutePort = {
      post: testDouble.fn((routePath, handler) => {
        handlers.set(routePath, handler);
      }),
    };

    registerArtifactRepoApiRoutes({
      app,
      hasArtifactInRepoUseCase: { execute: testDouble.fn() },
      storeArtifactInRepoUseCase: { execute: testDouble.fn() },
      publishArtifactToRepoUseCase: { execute: testDouble.fn() },
      verifyPublishedArtifactBackingUseCase: { execute: testDouble.fn() },
      registerArtifactFromRepoUseCase: { execute: testDouble.fn() },
      localizeArtifactFromRepoUseCase: { execute: testDouble.fn() },
    });

    const response = {
      status: testDouble.fn(() => response),
      json: testDouble.fn(),
    };

    await handlers.get("/api/artifact/publish")?.(
      {
        body: {
          artifactId: "",
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "",
          },
        },
        headers: {},
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    const body = (response.json as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0];
    expect(body).toMatchObject({
      ok: false,
      operation: "artifact.publish",
      error: {
        code: "validation",
      },
    });
  });
});
