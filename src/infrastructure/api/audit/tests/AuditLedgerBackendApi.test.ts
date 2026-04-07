import { describe, expect, it } from "bun:test";
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
import { AuditLedgerBackendApi } from "../AuditLedgerBackendApi";

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public constructor(private readonly events: ReadonlyArray<CanonicalAuditEvent>) {}

  public async appendAuditEvent(
    _event: CanonicalAuditEvent,
    _context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    throw new Error("append not used by AuditLedgerBackendApi tests");
  }

  public async listAuditEvents(query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    const offset = query.pagination?.offset ?? 0;
    const limit = query.pagination?.limit ?? this.events.length;
    return this.events.slice(offset, offset + limit);
  }

  public async countAuditEvents(): Promise<number> {
    return this.events.length;
  }

  public async getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined> {
    return this.events.find((event) => event.eventId === eventId);
  }
}

class StaticAuthorizer implements AuditLedgerQueryAuthorizer {
  public constructor(private readonly scope: AuditLedgerQueryReadScope) {}

  public async authorizeAuditLedgerRead() {
    return {
      allowed: true as const,
      scope: this.scope,
    };
  }
}

function createAuditEvent(eventId: string): CanonicalAuditEvent {
  return createCanonicalAuditEvent({
    eventId,
    eventType: "workspace-policy-updated",
    category: AuditEventCategories.policy,
    action: "policy.updated",
    outcome: "succeeded",
    occurredAt: "2026-04-07T19:00:00.000Z",
    recordedAt: "2026-04-07T19:00:30.000Z",
    actor: {
      actorId: "user:admin",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:admin",
    },
    scope: {
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace-alpha",
    },
    payload: {
      hasProtectedData: false,
      redactionReasons: [],
      userSafeDetails: {
        reason: "updated",
      },
    },
    integrity: {
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
    },
  });
}

describe("AuditLedgerBackendApi", () => {
  it("returns list/query metadata and deterministic pagination", async () => {
    const repository = new InMemoryAuditLedgerRepository([
      createAuditEvent("audit:event:1"),
      createAuditEvent("audit:event:2"),
    ]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const response = await api.listAuditEvents({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      query: {
        pagination: {
          limit: 1,
          offset: 0,
        },
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.events).toHaveLength(1);
    expect(response.data?.totalCount).toBe(2);
    expect(response.data?.pagination.hasMore).toBeTrue();
  });

  it("maps detail not-found into stable API semantics", async () => {
    const repository = new InMemoryAuditLedgerRepository([]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const response = await api.getAuditEventDetail({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace-alpha",
      eventId: "audit:event:missing",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("not-found");
  });

  it("returns invalid-request for missing actor/workspace context", async () => {
    const repository = new InMemoryAuditLedgerRepository([]);
    const api = new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository,
        authorizer: new StaticAuthorizer({
          workspaceIds: ["workspace-alpha"],
          detailVisibility: "admin",
          canReadProtectedData: true,
        }),
      }),
    });

    const listResponse = await api.listAuditEvents({
      actorUserIdentityId: " ",
      workspaceId: "workspace-alpha",
    });
    expect(listResponse.ok).toBeFalse();
    expect(listResponse.error?.code).toBe("invalid-request");

    const detailResponse = await api.getAuditEventDetail({
      actorUserIdentityId: "user:admin",
      workspaceId: " ",
      eventId: "audit:event:1",
    });
    expect(detailResponse.ok).toBeFalse();
    expect(detailResponse.error?.code).toBe("invalid-request");
  });
});

