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

    registerArtifactRepoApiRoutes({
      app,
      hasArtifactInRepoUseCase,
      storeArtifactInRepoUseCase,
    });

    expect(app.post).toHaveBeenCalledTimes(2);
    expect(handlers.has("/api/artifact-repo/has")).toBe(true);
    expect(handlers.has("/api/artifact-repo/store")).toBe(true);

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
    expect(response.status).toHaveBeenCalledWith(200);
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
});
