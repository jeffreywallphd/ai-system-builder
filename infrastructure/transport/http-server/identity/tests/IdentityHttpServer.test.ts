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

async function startServer(logger: CapturingLogger): Promise<{ readonly baseUrl: string }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger,
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

describe("IdentityHttpServer", () => {
  it("exposes end-to-end register and login endpoints", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "api.user",
        email: "api.user@example.com",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    expect(registerBody.ok).toBe(true);
    expect(registerBody.data.providerId).toBe("provider:local-password");

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "api.user",
        accessChannel: "thin-client",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.ok).toBe(true);
    expect(loginBody.data.username).toBe("api.user");
    expect(loginBody.data.authPath).toBe("password");
    expect(loginBody.data.sessionTokenType).toBe("Bearer");
    expect(loginBody.data.sessionToken).toBeDefined();
  });

  it("returns stable API error responses for validation and auth failures", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const invalidResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "",
        credential: {
          candidate: "",
        },
      }),
    });

    expect(invalidResponse.status).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
    expect(Array.isArray(invalidBody.error.validationErrors)).toBe(true);

    const failedLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "missing.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(failedLoginResponse.status).toBe(401);
    const failedLoginBody = await failedLoginResponse.json();
    expect(failedLoginBody.ok).toBe(false);
    expect(failedLoginBody.error.code).toBe("authentication-failed");
  });

  it("redacts credential material in transport logs", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "missing.user",
        credential: {
          candidate: "LeakySecret!2026",
        },
      }),
    });

    const serializedEvents = JSON.stringify(logger.events);
    expect(serializedEvents.includes("LeakySecret!2026")).toBeFalse();
    expect(serializedEvents.includes("[REDACTED]")).toBeTrue();
  });
});
