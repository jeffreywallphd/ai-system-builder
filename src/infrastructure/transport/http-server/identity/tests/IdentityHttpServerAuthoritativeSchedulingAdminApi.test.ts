import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { AuthoritativeRunMutationBackendApi } from "../../../../api/runs/AuthoritativeRunMutationBackendApi";
import type { AuthoritativeRunQueryBackendApi } from "../../../../api/runs/AuthoritativeRunQueryBackendApi";

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

class StubAuthoritativeRunMutationBackendApi {
  public lastReleaseRequest: Readonly<Record<string, unknown>> | undefined;
  public lastReevaluateRequest: Readonly<Record<string, unknown>> | undefined;

  public async cancelRun() {
    return Object.freeze({ ok: false as const, error: Object.freeze({ code: "not-found", message: "unused" }) });
  }

  public async retryRun() {
    return Object.freeze({ ok: false as const, error: Object.freeze({ code: "not-found", message: "unused" }) });
  }

  public async releaseStaleSchedulingReservation(request: Readonly<Record<string, unknown>>) {
    this.lastReleaseRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        runId: "run:stale:1",
        queueId: "queue:default",
        releasedAt: "2026-04-07T12:01:00.000Z",
        staleSeconds: 60,
        reservationOwner: "scheduler:alpha",
        mutation: Object.freeze({
          changed: true,
          mutationId: "mutation:release:1",
          occurredAt: "2026-04-07T12:01:00.000Z",
        }),
      }),
    });
  }

  public async reevaluateDeferredSchedulingRuns(request: Readonly<Record<string, unknown>>) {
    this.lastReevaluateRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        requestedAt: "2026-04-07T12:01:00.000Z",
        reEvaluatedCount: 1,
        runIds: Object.freeze(["run:deferred:1"]),
        mutation: Object.freeze({
          changed: true,
          mutationId: "mutation:reevaluate:1",
          occurredAt: "2026-04-07T12:01:00.000Z",
        }),
      }),
    });
  }
}

class StubAuthoritativeRunQueryBackendApi {
  public lastStaleReadRequest: Readonly<Record<string, unknown>> | undefined;

  public async listRuns() {
    return Object.freeze({ ok: true as const, data: Object.freeze({ items: Object.freeze([]), totalCount: 0 }) });
  }

  public async listQueueStatus() {
    return Object.freeze({ ok: true as const, data: Object.freeze({ items: Object.freeze([]), totalCount: 0, asOf: "2026-04-07T12:00:00.000Z" }) });
  }

  public async listStaleSchedulingReservations(request: Readonly<Record<string, unknown>>) {
    this.lastStaleReadRequest = request;
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        asOf: "2026-04-07T12:01:00.000Z",
        totalCount: 1,
        items: Object.freeze([Object.freeze({
          runId: "run:stale:1",
          queueId: "queue:default",
          workspaceId: "workspace-alpha",
          claimToken: "queue-claim:1",
          claimedBy: "scheduler:alpha",
          claimedAt: "2026-04-07T11:58:00.000Z",
          claimExpiresAt: "2026-04-07T12:00:00.000Z",
          staleSeconds: 60,
        })]),
      }),
    });
  }

  public async getRunDetail() {
    return Object.freeze({ ok: false as const, error: Object.freeze({ code: "not-found", message: "unused" }) });
  }

  public async getRunStatus() {
    return Object.freeze({ ok: false as const, error: Object.freeze({ code: "not-found", message: "unused" }) });
  }
}

async function startServer(
  runMutationBackend: StubAuthoritativeRunMutationBackendApi,
  runQueryBackend: StubAuthoritativeRunQueryBackendApi,
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    authoritativeRunMutationBackendApi: runMutationBackend as unknown as AuthoritativeRunMutationBackendApi,
    authoritativeRunQueryBackendApi: runQueryBackend as unknown as AuthoritativeRunQueryBackendApi,
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
  return `http://127.0.0.1:${address.port}`;
}

async function registerAndLogin(baseUrl: string, username: string): Promise<string> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();
  return loginBody.data.sessionToken as string;
}

describe("IdentityHttpServer authoritative scheduling admin routes", () => {
  it("returns stale scheduling reservations for authenticated workspace requests", async () => {
    const mutationBackend = new StubAuthoritativeRunMutationBackendApi();
    const queryBackend = new StubAuthoritativeRunQueryBackendApi();
    const baseUrl = await startServer(mutationBackend, queryBackend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.scheduling.admin.1");

    const response = await fetch(
      `${baseUrl}/api/v1/runtime/scheduling/admin/reservations/stale?workspaceId=workspace-alpha&queueId=queue:default`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalCount).toBe(1);
    expect(queryBackend.lastStaleReadRequest?.workspaceId).toBe("workspace-alpha");
  });

  it("releases stale reservations and re-evaluates deferred runs through scheduling admin mutation routes", async () => {
    const mutationBackend = new StubAuthoritativeRunMutationBackendApi();
    const queryBackend = new StubAuthoritativeRunQueryBackendApi();
    const baseUrl = await startServer(mutationBackend, queryBackend);
    const token = await registerAndLogin(baseUrl, "runtime.authoritative.scheduling.admin.2");

    const releaseResponse = await fetch(
      `${baseUrl}/api/v1/runtime/scheduling/admin/reservations/stale/release?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          runId: "run:stale:1",
          claimToken: "queue-claim:1",
        }),
      },
    );
    expect(releaseResponse.status).toBe(200);
    const releaseBody = await releaseResponse.json();
    expect(releaseBody.ok).toBe(true);
    expect(mutationBackend.lastReleaseRequest?.workspaceId).toBe("workspace-alpha");

    const reevaluateResponse = await fetch(
      `${baseUrl}/api/v1/runtime/scheduling/admin/deferred/re-evaluate?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          queueId: "queue:default",
          runIds: ["run:deferred:1"],
        }),
      },
    );
    expect(reevaluateResponse.status).toBe(200);
    const reevaluateBody = await reevaluateResponse.json();
    expect(reevaluateBody.ok).toBe(true);
    expect(reevaluateBody.data.reEvaluatedCount).toBe(1);
    expect(mutationBackend.lastReevaluateRequest?.workspaceId).toBe("workspace-alpha");
  });
});

