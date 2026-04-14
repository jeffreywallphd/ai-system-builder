import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogEvent,
  type IdentityHttpServerLogger,
} from "../IdentityHttpServer";

class CapturingLogger implements IdentityHttpServerLogger {
  public readonly events: IdentityHttpServerLogEvent[] = [];

  public info(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }

  public warn(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }

  public error(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
});

async function startServer(
  logger: CapturingLogger,
  serverOptions: Partial<Parameters<typeof createIdentityHttpServer>[0]> = {},
): Promise<{ readonly baseUrl: string }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger,
    ...serverOptions,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);

  const address = server.address() as AddressInfo;
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
  });
}

describe("IdentityHttpServer authorization context snapshot diagnostics", () => {
  it("emits actor-context-missing diagnostics when session authentication fails before actor resolution", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const response = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
    });
    expect(response.status).toBe(401);

    const snapshot = logger.events.find((event) => (
      event.event === "authorization.context.snapshot"
      && event.path === "/api/v1/identity/session"
      && event.details?.diagnostic
    ));
    expect(snapshot).toBeDefined();
    expect(snapshot?.details?.diagnostic).toMatchObject({
      outcome: "deny",
      reasonCode: "actor-context-missing",
      denialProvenanceStage: "actor-snapshot",
    });
  });

  it("emits workspace-context diagnostics at workspace-session entry points", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger, {
      storageManagementBackendApi: {
        async createStorageInstance() {
          return Object.freeze({
            ok: false,
            error: Object.freeze({
              code: "invalid-request",
              message: "unsupported in test",
            }),
          });
        },
      } as never,
    });

    const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "ctx.workspace.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(register.status).toBe(200);

    const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "ctx.workspace.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(login.status).toBe(200);
    const loginBody = await login.json() as {
      readonly data?: {
        readonly sessionToken?: string;
      };
    };
    const token = loginBody.data?.sessionToken as string;

    const missingWorkspace = await fetch(`${baseUrl}/api/v1/storage/instances`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    expect(missingWorkspace.status).toBe(400);

    const missingSnapshot = logger.events.find((event) => (
      event.event === "authorization.context.snapshot"
      && event.path === "/api/v1/storage/instances"
      && (event.details?.diagnostic as { reasonCode?: string } | undefined)?.reasonCode === "workspace-context-missing"
    ));
    expect(missingSnapshot).toBeDefined();

    const resolvedWorkspace = await fetch(`${baseUrl}/api/v1/storage/instances?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    expect(resolvedWorkspace.status).toBe(400);

    const resolvedSnapshot = logger.events.find((event) => (
      event.event === "authorization.context.snapshot"
      && event.path === "/api/v1/storage/instances"
      && (event.details?.diagnostic as { reasonCode?: string; outcome?: string } | undefined)?.reasonCode === "workspace-context-resolved"
    ));
    expect(resolvedSnapshot).toBeDefined();
    expect((resolvedSnapshot?.details?.diagnostic as { outcome?: string } | undefined)?.outcome).toBe("observed");
  });
});
