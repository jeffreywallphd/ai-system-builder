import { describe, expect, it } from "bun:test";
import {
  IdentitySessionAccessChannels,
  IdentitySessionStatuses,
  createSession,
  type Session,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityErrorCodes,
  IdentityIdNamespaces,
  identityFailure,
  identitySuccess,
  type IdentityMutationOutcome,
  type IdentityOperationResult,
  type IdentitySessionListQuery,
} from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import { IdentitySessionLifecycleService } from "../services/IdentitySessionLifecycleService";

class InMemorySessionLifecycleAdapter implements IIdentitySessionRepository, IIdentityClock, IIdentityIdGenerator {
  private readonly sessions = new Map<string, Session>();
  private sequence = 0;
  private current = new Date("2026-04-04T12:00:00.000Z");

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public setNow(value: string): void {
    this.current = new Date(value);
  }

  public nextId(namespace: typeof IdentityIdNamespaces[keyof typeof IdentityIdNamespaces]): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }

  public async saveSession(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId.trim());
  }

  public async listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    const includeStatuses = query.includeStatuses;
    const expiresBefore = query.expiresBefore ? new Date(query.expiresBefore).getTime() : undefined;
    const expiresAfter = query.expiresAfter ? new Date(query.expiresAfter).getTime() : undefined;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;

    const sessions = [...this.sessions.values()].filter((session) => {
      if (session.userIdentityId !== query.userIdentityId) {
        return false;
      }
      if (includeStatuses && includeStatuses.length > 0 && !includeStatuses.includes(session.status)) {
        return false;
      }

      const expiresAt = new Date(session.expiresAt).getTime();
      if (expiresBefore !== undefined && expiresAt >= expiresBefore) {
        return false;
      }
      if (expiresAfter !== undefined && expiresAt <= expiresAfter) {
        return false;
      }
      return true;
    }).sort((left, right) => left.issuedAt.localeCompare(right.issuedAt));

    return limit ? sessions.slice(0, limit) : sessions;
  }

  public async removeSession(
    sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    const normalized = sessionId.trim();
    if (!normalized) {
      return identityFailure({
        code: IdentityErrorCodes.invalidSessionState,
        message: "Session id is required.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    return identitySuccess({
      changed: this.sessions.delete(normalized),
    });
  }
}

describe("IdentitySessionLifecycleService", () => {
  it("issues sessions with policy-managed ttl for desktop and thin-client channels", async () => {
    const adapter = new InMemorySessionLifecycleAdapter();
    const service = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });

    const thinResult = await service.issueSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
      client: {
        userAgent: "browser",
        ipAddress: "127.0.0.1",
      },
    });
    expect(thinResult.ok).toBeTrue();
    if (!thinResult.ok) {
      throw new Error("Expected thin-client issue to succeed.");
    }
    expect(thinResult.value.session.status).toBe(IdentitySessionStatuses.active);
    expect(thinResult.value.session.expiresAt).toBe("2026-04-05T00:00:00.000Z");
    expect(thinResult.value.session.client?.accessChannel).toBe(IdentitySessionAccessChannels.thinClient);

    const desktopResult = await service.issueSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.desktop,
      client: {
        deviceId: "desktop-device-1",
      },
    });
    expect(desktopResult.ok).toBeTrue();
    if (!desktopResult.ok) {
      throw new Error("Expected desktop issue to succeed.");
    }
    expect(desktopResult.value.session.expiresAt).toBe("2026-05-04T12:00:00.000Z");
    expect(desktopResult.value.policy.allowRefresh).toBeFalse();
  });

  it("refreshes active sessions when policy allows refresh and rotates the prior session", async () => {
    const adapter = new InMemorySessionLifecycleAdapter();
    const service = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });

    const issued = await service.issueSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });
    if (!issued.ok) {
      throw new Error("Expected session issue to succeed.");
    }

    adapter.setNow("2026-04-04T13:00:00.000Z");
    const refreshed = await service.refreshSession({ sessionId: issued.value.session.id });
    expect(refreshed.ok).toBeTrue();
    if (!refreshed.ok) {
      throw new Error("Expected refresh to succeed.");
    }

    expect(refreshed.value.priorSession.status).toBe(IdentitySessionStatuses.rotated);
    expect(refreshed.value.priorSession.replacedBySessionId).toBe(refreshed.value.refreshedSession.id);
    expect(refreshed.value.refreshedSession.status).toBe(IdentitySessionStatuses.active);
    expect(refreshed.value.refreshedSession.issuedAt).toBe("2026-04-04T13:00:00.000Z");
  });

  it("blocks refresh for active desktop sessions because refresh is not applicable by policy", async () => {
    const adapter = new InMemorySessionLifecycleAdapter();
    const service = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });

    const issued = await service.issueSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.desktop,
    });
    if (!issued.ok) {
      throw new Error("Expected desktop issue to succeed.");
    }

    const refreshed = await service.refreshSession({ sessionId: issued.value.session.id });
    expect(refreshed).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: IdentityErrorCodes.invalidSessionState,
      }),
    });
  });

  it("expires due sessions and only mutates active sessions past expiresAt", async () => {
    const adapter = new InMemorySessionLifecycleAdapter();
    const service = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });

    await adapter.saveSession(createSession({
      id: "session:expired-candidate",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      issuedAt: new Date("2026-04-04T10:00:00.000Z"),
      expiresAt: new Date("2026-04-04T11:00:00.000Z"),
      client: {
        accessChannel: IdentitySessionAccessChannels.thinClient,
      },
    }));
    await adapter.saveSession(createSession({
      id: "session:not-due",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      issuedAt: new Date("2026-04-04T11:00:00.000Z"),
      expiresAt: new Date("2026-04-04T14:00:00.000Z"),
      client: {
        accessChannel: IdentitySessionAccessChannels.thinClient,
      },
    }));

    adapter.setNow("2026-04-04T12:00:00.000Z");
    const sweep = await service.expireDueSessions({ userIdentityId: "user:1" });
    expect(sweep.ok).toBeTrue();
    if (!sweep.ok) {
      throw new Error("Expected expiration sweep to succeed.");
    }
    expect(sweep.value.expiredSessionIds).toEqual(["session:expired-candidate"]);
    expect((await adapter.getSessionById("session:expired-candidate"))?.status).toBe(IdentitySessionStatuses.expired);
    expect((await adapter.getSessionById("session:not-due"))?.status).toBe(IdentitySessionStatuses.active);
  });
});
