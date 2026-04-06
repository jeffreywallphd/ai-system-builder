import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogEvent,
  type IdentityHttpServerLogger,
} from "../IdentityHttpServer";
import type { ValidateTransportConnectionTrustRequest } from "../../../../../application/security/ports/TransportTrustValidationPorts";
import { TransportSecurityScenarios } from "../../../../../domain/security/TransportSecurityDomain";
import type { HttpTransportTrustValidationResult } from "../../../../../infrastructure/transport/TransportTrustValidationAdapters";

class NoopLogger implements IdentityHttpServerLogger {
  public info(_event: IdentityHttpServerLogEvent): void {}
  public warn(_event: IdentityHttpServerLogEvent): void {}
  public error(_event: IdentityHttpServerLogEvent): void {}
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

async function startServer(input: {
  readonly allowInsecureLoopback: boolean;
  readonly secureTransport?: {
    readonly requireHttps: boolean;
    readonly allowInsecureLoopback: boolean;
  };
  readonly logger?: IdentityHttpServerLogger;
  readonly validate: (request: ValidateTransportConnectionTrustRequest) => Promise<HttpTransportTrustValidationResult>;
}): Promise<{ readonly baseUrl: string }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger: input.logger ?? new NoopLogger(),
    secureTransport: input.secureTransport,
    transportTrust: {
      httpValidator: {
        validate: input.validate,
      },
      allowInsecureLoopback: input.allowInsecureLoopback,
      defaultScenario: TransportSecurityScenarios.thinClientToControlPlane,
    },
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

async function registerAndLogin(
  baseUrl: string,
  accessChannel: "desktop" | "thin-client" = "thin-client",
): Promise<string> {
  const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "transport.trust.user",
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
      providerSubject: "transport.trust.user",
      accessChannel,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(login.status).toBe(200);
  const loginBody = await login.json() as { readonly data: { readonly sessionToken: string } };
  return loginBody.data.sessionToken;
}

describe("IdentityHttpServer transport trust", () => {
  it("rejects insecure API requests before handlers when HTTPS is required", async () => {
    const { baseUrl } = await startServer({
      allowInsecureLoopback: false,
      secureTransport: {
        requireHttps: true,
        allowInsecureLoopback: false,
      },
      validate: async () => ({
        ok: true,
        decision: {} as never,
      }),
    });

    const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "transport.trust.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(register.status).toBe(403);
    const body = await register.json() as { readonly ok: boolean; readonly error?: { readonly code?: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("forbidden");
  });

  it("allows loopback API requests when secure transport permits explicit loopback fallback", async () => {
    const { baseUrl } = await startServer({
      allowInsecureLoopback: true,
      secureTransport: {
        requireHttps: true,
        allowInsecureLoopback: true,
      },
      validate: async () => ({
        ok: true,
        decision: {} as never,
      }),
    });

    const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "transport.trust.loopback.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(register.status).toBe(200);
  });

  it("rejects authenticated routes when transport trust validator denies request", async () => {
    const { baseUrl } = await startServer({
      allowInsecureLoopback: false,
      validate: async () => ({
        ok: false,
        statusCode: 403,
        body: {
          ok: false,
          error: {
            code: "forbidden",
            message: "Transport trust validation rejected this connection.",
          },
        },
      }),
    });

    const sessionToken = await registerAndLogin(baseUrl);
    const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    expect(resolvedSession.status).toBe(403);
  });

  it("bypasses strict transport trust for explicit loopback allowance", async () => {
    const seenRequests: ValidateTransportConnectionTrustRequest[] = [];
    const { baseUrl } = await startServer({
      allowInsecureLoopback: true,
      validate: async (request) => {
        seenRequests.push(request);
        throw new Error(`validator-should-not-run:${request.connectionId}`);
      },
    });

    const sessionToken = await registerAndLogin(baseUrl, "desktop");
    const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    expect(resolvedSession.status).toBe(200);
    expect(seenRequests).toHaveLength(0);
  });

  it("does not bypass transport trust validation for thin-client sessions on loopback", async () => {
    const seenRequests: ValidateTransportConnectionTrustRequest[] = [];
    const { baseUrl } = await startServer({
      allowInsecureLoopback: true,
      validate: async (request) => {
        seenRequests.push(request);
        return {
          ok: false,
          statusCode: 403,
          body: {
            ok: false,
            error: {
              code: "forbidden",
              message: "Transport trust validation rejected this connection.",
            },
          },
        };
      },
    });

    const sessionToken = await registerAndLogin(baseUrl, "thin-client");
    const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    expect(resolvedSession.status).toBe(403);
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.scenario).toBe("thin-client-to-control-plane");
    expect(seenRequests[0]?.remotePeerType).toBe("thin-client");
  });

  it("maps desktop sessions to desktop transport scenario when validating trust", async () => {
    const seenRequests: ValidateTransportConnectionTrustRequest[] = [];
    const { baseUrl } = await startServer({
      allowInsecureLoopback: false,
      validate: async (request) => {
        seenRequests.push(request);
        return {
          ok: true,
          decision: {} as never,
        };
      },
    });

    const sessionToken = await registerAndLogin(baseUrl, "desktop");
    const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    expect(resolvedSession.status).toBe(200);
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0]?.scenario).toBe("desktop-client-to-control-plane");
    expect(seenRequests[0]?.remotePeerType).toBe("desktop-client");
  });

  it("emits authenticated transport context through request logging payload", async () => {
    const events: unknown[] = [];
    class CapturingLogger extends NoopLogger {
      public override info(event: IdentityHttpServerLogEvent): void {
        events.push(event);
      }
    }

    const { baseUrl } = await startServer({
      allowInsecureLoopback: true,
      logger: new CapturingLogger(),
      validate: async () => ({
        ok: true,
        decision: {} as never,
      }),
    });

    const sessionToken = await registerAndLogin(baseUrl, "thin-client");
    const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    expect(resolvedSession.status).toBe(200);

    const completed = events.filter((event) => {
      const candidate = event as { readonly event?: string };
      return candidate.event === "identity-http.request.completed";
    }) as Array<{ readonly details?: { readonly request?: { readonly transport?: { readonly connection?: { readonly channelType?: string }; readonly channel?: { readonly accessChannel?: string; readonly thinClient?: { readonly browserSurface?: boolean } } } } } }>;
    expect(completed.length).toBeGreaterThan(0);
    const latest = completed[completed.length - 1];
    expect(latest?.details?.request?.transport?.connection?.channelType).toBe("http");
    expect(latest?.details?.request?.transport?.channel?.accessChannel).toBe("thin-client");
    expect(latest?.details?.request?.transport?.channel?.thinClient?.browserSurface).toBeTrue();
  });
});
