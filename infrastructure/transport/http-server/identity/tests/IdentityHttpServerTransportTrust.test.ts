import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogger,
} from "../IdentityHttpServer";
import type { ValidateTransportConnectionTrustRequest } from "../../../../../src/application/security/ports/TransportTrustValidationPorts";
import { TransportSecurityScenarios } from "../../../../../src/domain/security/TransportSecurityDomain";
import type { HttpTransportTrustValidationResult } from "../../../../../src/infrastructure/transport/TransportTrustValidationAdapters";

class NoopLogger implements IdentityHttpServerLogger {
  public info(): void {}
  public warn(): void {}
  public error(): void {}
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
  readonly validate: (request: ValidateTransportConnectionTrustRequest) => Promise<HttpTransportTrustValidationResult>;
}): Promise<{ readonly baseUrl: string }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger: new NoopLogger(),
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

async function registerAndLogin(baseUrl: string): Promise<string> {
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

    const sessionToken = await registerAndLogin(baseUrl);
    const resolvedSession = await fetch(`${baseUrl}/api/v1/identity/session`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });
    expect(resolvedSession.status).toBe(200);
    expect(seenRequests).toHaveLength(0);
  });
});
