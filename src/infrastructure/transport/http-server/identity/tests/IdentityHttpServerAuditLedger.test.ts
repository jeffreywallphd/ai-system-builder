import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { AuditLedgerBackendApi } from "../../../../api/audit/AuditLedgerBackendApi";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditScopeKinds,
  createCanonicalAuditEvent,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "@application/audit/AuditApplicationContracts";
import {
  AuditLedgerQueryService,
  type AuditLedgerQueryAuthorizer,
  type AuditLedgerQueryReadScope,
} from "@application/audit/use-cases/AuditLedgerQueryService";
import { AuditEventThinSafeCategories } from "@shared/contracts/audit/AuditEventContracts";
import type { AuditLedgerListQueryDto } from "@shared/dto/audit/AuditEventDtos";

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

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public constructor(private readonly events: ReadonlyArray<CanonicalAuditEvent>) {}

  public async appendAuditEvent(
    _event: CanonicalAuditEvent,
    _context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    throw new Error("append not used by IdentityHttpServer audit route tests");
  }

  public async listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    const sorted = [...this.filter(query)].sort((left, right) => {
      const direction = query.sorting?.sortDirection === "asc" ? 1 : -1;
      return direction * (Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
    });
    const offset = query.pagination?.offset ?? query.offset ?? 0;
    const limit = query.pagination?.limit ?? query.limit ?? sorted.length;
    return Object.freeze(sorted.slice(offset, offset + limit));
  }

  public async countAuditEvents(query: AuditLedgerQuery): Promise<number> {
    return this.filter(query).length;
  }

  public async getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined> {
    return this.events.find((event) => event.eventId === eventId);
  }

  private filter(query: AuditLedgerQuery): ReadonlyArray<CanonicalAuditEvent> {
    return this.events.filter((event) => {
      const workspace = query.workspaceId ?? query.filters?.workspaceIds?.[0];
      if (workspace && event.scope.workspaceId !== workspace) {
        return false;
      }

      if (query.filters?.categories && query.filters.categories.length > 0 && !query.filters.categories.includes(event.category)) {
        return false;
      }
      if (query.filters?.hasProtectedData === true && !event.payload.hasProtectedData) {
        return false;
      }
      if (query.filters?.hasProtectedData === false && event.payload.hasProtectedData) {
        return false;
      }
      return true;
    });
  }
}

class ActorScopedAuthorizer implements AuditLedgerQueryAuthorizer {
  public constructor(
    private readonly members: Readonly<Record<string, "admin" | "member">>,
    private readonly workspaceId: string,
  ) {}

  public async authorizeAuditLedgerRead(input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }): Promise<{
    readonly allowed: boolean;
    readonly scope?: AuditLedgerQueryReadScope;
    readonly reason?: string;
  }> {
    const role = this.members[input.requesterId];
    if (!role) {
      return {
        allowed: false,
        reason: "Requester is not authorized for workspace audit access.",
      };
    }
    if (input.query.workspaceId !== this.workspaceId) {
      return {
        allowed: false,
        reason: "Audit ledger reads require exactly one workspace scope.",
      };
    }

    if (role === "admin") {
      return {
        allowed: true,
        scope: {
          workspaceIds: [this.workspaceId],
          canReadProtectedData: true,
          detailVisibility: "admin",
        },
      };
    }

    return {
      allowed: true,
      scope: {
        workspaceIds: [this.workspaceId],
        enforceThinSafeOnly: true,
        canReadProtectedData: false,
        allowedCategories: AuditEventThinSafeCategories,
        detailVisibility: "user-safe",
      },
    };
  }
}

function createAuditEvent(input: {
  readonly eventId: string;
  readonly category: "administrative" | "protected-data";
  readonly occurredAt: string;
}): CanonicalAuditEvent {
  return createCanonicalAuditEvent({
    eventId: input.eventId,
    eventType: input.category === "administrative" ? "workspace-member-updated" : "secret-access-evaluated",
    category: input.category,
    action: input.category === "administrative" ? "workspace.member.updated" : "secret.read.access-evaluated",
    outcome: "succeeded",
    occurredAt: input.occurredAt,
    actor: {
      actorId: "user:auditor",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:auditor",
    },
    scope: {
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace-alpha",
    },
    payload: input.category === "administrative"
      ? {
        hasProtectedData: false,
        redactionReasons: [],
        userSafeDetails: {
          operation: "membership-updated",
        },
      }
      : {
        hasProtectedData: true,
        redactionReasons: ["secret-material"],
        userSafeDetails: {
          decision: "allowed",
        },
        adminOnlyDetails: {
          secretId: "secret:server:provider:openai",
        },
      },
    integrity: {
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
    },
    recordedAt: input.occurredAt,
  });
}

async function startServer(input: {
  readonly members: Readonly<Record<string, "admin" | "member">>;
}): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const repository = new InMemoryAuditLedgerRepository(Object.freeze([
    createAuditEvent({
      eventId: "audit:event:admin",
      category: AuditEventCategories.administrative,
      occurredAt: "2026-04-07T19:00:00.000Z",
    }),
    createAuditEvent({
      eventId: "audit:event:protected",
      category: AuditEventCategories.protectedData,
      occurredAt: "2026-04-07T19:01:00.000Z",
    }),
  ]));
  const auditLedgerBackendApi = new AuditLedgerBackendApi({
    auditLedgerQueryService: new AuditLedgerQueryService({
      repository,
      authorizer: new ActorScopedAuthorizer(input.members, "workspace-alpha"),
    }),
  });

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    auditLedgerBackendApi,
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

async function registerAndLogin(baseUrl: string, username: string): Promise<{
  readonly userIdentityId: string;
  readonly sessionToken: string;
}> {
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
  const registerBody = await registerResponse.json();

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

  return Object.freeze({
    userIdentityId: registerBody.data.userIdentityId as string,
    sessionToken: loginBody.data.sessionToken as string,
  });
}

describe("IdentityHttpServer audit ledger routes", () => {
  it("enforces auth and workspace guards for audit list/detail routes", async () => {
    const baseUrl = await startServer({
      members: {},
    });
    const actor = await registerAndLogin(baseUrl, "audit.guard.user");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/audit/events?workspaceId=workspace-alpha`);
    expect(unauthenticated.status).toBe(401);

    const missingWorkspace = await fetch(`${baseUrl}/api/v1/audit/events`, {
      headers: { authorization: `Bearer ${actor.sessionToken}` },
    });
    expect(missingWorkspace.status).toBe(400);
    const missingWorkspaceBody = await missingWorkspace.json();
    expect(missingWorkspaceBody.ok).toBe(false);
    expect(missingWorkspaceBody.error.code).toBe("invalid-request");
  });

  it("returns permission-aware list/detail projections and redacted visibility tiers", async () => {
    const members: Record<string, "admin" | "member"> = {};
    const baseUrl = await startServer({ members });
    const admin = await registerAndLogin(baseUrl, "audit.admin.user");
    const member = await registerAndLogin(baseUrl, "audit.member.user");
    members[admin.userIdentityId] = "admin";
    members[member.userIdentityId] = "member";

    const adminList = await fetch(
      `${baseUrl}/api/v1/audit/events?workspaceId=workspace-alpha&limit=1&offset=0`,
      {
        headers: { authorization: `Bearer ${admin.sessionToken}` },
      },
    );
    expect(adminList.status).toBe(200);
    const adminListBody = await adminList.json();
    expect(adminListBody.ok).toBe(true);
    expect(adminListBody.data.totalCount).toBe(2);
    expect(adminListBody.data.pagination.hasMore).toBe(true);

    const memberList = await fetch(
      `${baseUrl}/api/v1/audit/events?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${member.sessionToken}` },
      },
    );
    expect(memberList.status).toBe(200);
    const memberListBody = await memberList.json();
    expect(memberListBody.ok).toBe(true);
    expect(memberListBody.data.events).toHaveLength(1);
    expect(memberListBody.data.events[0].category).toBe("administrative");

    const governanceList = await fetch(
      `${baseUrl}/api/v1/audit/governance/events?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${member.sessionToken}` },
      },
    );
    expect(governanceList.status).toBe(200);
    const governanceListBody = await governanceList.json();
    expect(governanceListBody.ok).toBe(true);
    expect(governanceListBody.data.events).toHaveLength(1);
    expect(governanceListBody.data.facets.some((facet: { key: string }) => facet.key === "eventType")).toBeTrue();

    const adminDetail = await fetch(
      `${baseUrl}/api/v1/audit/events/audit%3Aevent%3Aprotected?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${admin.sessionToken}` },
      },
    );
    expect(adminDetail.status).toBe(200);
    const adminDetailBody = await adminDetail.json();
    expect(adminDetailBody.ok).toBe(true);
    expect(adminDetailBody.data.event.visibility).toBe("admin");
    expect(adminDetailBody.data.event.adminOnlyDetails.secretId).toBe("secret:server:provider:openai");

    const memberProtectedDetail = await fetch(
      `${baseUrl}/api/v1/audit/events/audit%3Aevent%3Aprotected?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${member.sessionToken}` },
      },
    );
    expect(memberProtectedDetail.status).toBe(404);
    const memberProtectedDetailBody = await memberProtectedDetail.json();
    expect(memberProtectedDetailBody.ok).toBe(false);
    expect(memberProtectedDetailBody.error.code).toBe("not-found");

    const governanceAdminDetail = await fetch(
      `${baseUrl}/api/v1/audit/governance/events/audit%3Aevent%3Aprotected?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${admin.sessionToken}` },
      },
    );
    expect(governanceAdminDetail.status).toBe(200);
    const governanceAdminDetailBody = await governanceAdminDetail.json();
    expect(governanceAdminDetailBody.ok).toBe(true);
    expect(governanceAdminDetailBody.data.event.visibility).toBe("admin");

    const governanceMemberDetail = await fetch(
      `${baseUrl}/api/v1/audit/governance/events/audit%3Aevent%3Aprotected?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${member.sessionToken}` },
      },
    );
    expect(governanceMemberDetail.status).toBe(404);
  });

  it("maps permission denial and invalid query semantics to canonical status codes", async () => {
    const members: Record<string, "admin" | "member"> = {};
    const baseUrl = await startServer({ members });
    const outsider = await registerAndLogin(baseUrl, "audit.outsider.user");

    const forbiddenList = await fetch(
      `${baseUrl}/api/v1/audit/events?workspaceId=workspace-alpha`,
      {
        headers: { authorization: `Bearer ${outsider.sessionToken}` },
      },
    );
    expect(forbiddenList.status).toBe(403);
    const forbiddenBody = await forbiddenList.json();
    expect(forbiddenBody.ok).toBe(false);
    expect(forbiddenBody.error.code).toBe("forbidden");

    members[outsider.userIdentityId] = "admin";
    const invalidQuery = await fetch(
      `${baseUrl}/api/v1/audit/events?workspaceId=workspace-alpha&limit=0`,
      {
        headers: { authorization: `Bearer ${outsider.sessionToken}` },
      },
    );
    expect(invalidQuery.status).toBe(400);
    const invalidQueryBody = await invalidQuery.json();
    expect(invalidQueryBody.ok).toBe(false);
    expect(invalidQueryBody.error.code).toBe("invalid-request");
    expect(Array.isArray(invalidQueryBody.error.validationErrors)).toBeTrue();
  });
});
