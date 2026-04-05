import { describe, expect, it } from "bun:test";
import {
  IdentitySessionAccessChannels,
  IdentitySessionStatuses,
  SessionRevocationReasons,
  type Session,
} from "../../../src/domain/identity/IdentityDomain";
import { IdentityLifecycleEventTypes, type IdentityLifecycleEvent } from "../../contracts/IdentityLifecycleEventContracts";
import type { IdentitySessionTokenMaterialRecord } from "../../contracts/IdentityApplicationContracts";
import {
  IdentityErrorCodes,
  identitySuccess,
  type IdentityIdNamespace,
  type IdentityMutationOutcome,
  type IdentityOperationResult,
  type IdentitySessionListQuery,
} from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../ports/IIdentitySessionTokenMaterialRepository";
import type { IIdentitySessionTrustEvaluator } from "../ports/IIdentitySessionTrustEvaluator";
import type {
  IdentitySessionTokenIssueResult,
  IIdentitySessionTokenService,
} from "../ports/IIdentitySessionTokenService";
import { IdentityAuthenticatedSessionService } from "../services/IdentityAuthenticatedSessionService";
import { IdentitySessionLifecycleService } from "../services/IdentitySessionLifecycleService";

class InMemoryIdentitySessionAdapter
  implements
    IIdentitySessionRepository,
    IIdentitySessionTokenMaterialRepository,
    IIdentityClock,
    IIdentityIdGenerator,
    IIdentitySessionTokenService {
  private readonly sessions = new Map<string, Session>();
  private readonly tokenMaterialBySession = new Map<string, IdentitySessionTokenMaterialRecord>();
  private readonly tokenMaterialByHash = new Map<string, IdentitySessionTokenMaterialRecord>();
  private sequence = 0;
  private tokenSequence = 0;
  private current = new Date("2026-04-04T12:00:00.000Z");

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public setNow(value: string): void {
    this.current = new Date(value);
  }

  public nextId(namespace: IdentityIdNamespace): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }

  public issueToken(): IdentitySessionTokenIssueResult {
    this.tokenSequence += 1;
    const token = `session-token-${this.tokenSequence}`;
    return Object.freeze({
      token,
      tokenHash: this.hashToken(token),
      hashAlgorithm: "sha256",
      tokenType: "opaque-bearer",
    });
  }

  public hashToken(token: string): string {
    return `hash:${token.trim()}`;
  }

  public async saveSession(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId.trim());
  }

  public async listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    return Object.freeze(
      [...this.sessions.values()].filter((session) => session.userIdentityId === query.userIdentityId),
    );
  }

  public async removeSession(
    _sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    return identitySuccess(Object.freeze({ changed: false }));
  }

  public async saveSessionTokenMaterial(record: IdentitySessionTokenMaterialRecord): Promise<IdentitySessionTokenMaterialRecord> {
    this.tokenMaterialBySession.set(record.sessionId, record);
    this.tokenMaterialByHash.set(record.tokenHash, record);
    return record;
  }

  public async getSessionTokenMaterialBySessionId(
    sessionId: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    return this.tokenMaterialBySession.get(sessionId.trim());
  }

  public async getSessionTokenMaterialByTokenHash(
    tokenHash: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    return this.tokenMaterialByHash.get(tokenHash.trim());
  }

  public async invalidateSessionTokenMaterial(
    sessionId: string,
    invalidatedAt: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const existing = this.tokenMaterialBySession.get(sessionId.trim());
    if (!existing) {
      return undefined;
    }

    const updated = Object.freeze({
      ...existing,
      invalidatedAt,
      updatedAt: invalidatedAt,
    });
    this.tokenMaterialBySession.set(existing.sessionId, updated);
    this.tokenMaterialByHash.set(existing.tokenHash, updated);
    return updated;
  }
}

describe("IdentityAuthenticatedSessionService", () => {
  it("carries optional trusted-device session context through issuance and resolution", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
      client: {
        deviceId: "device:alpha",
        trustedDeviceBindingId: "trusted-device:alpha",
        trustMarker: "marker:alpha",
      },
    });
    if (!issued.ok) {
      throw new Error("Expected session issue success.");
    }

    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) {
      throw new Error("Expected token lookup success.");
    }
    expect(resolved.value.session.client?.deviceId).toBe("device:alpha");
    expect(resolved.value.trustedDeviceBindingId).toBe("trusted-device:alpha");
    expect(resolved.value.trustMarker).toBe("marker:alpha");
  });

  it("issues persisted authenticated sessions and resolves active session by token", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const events: IdentityLifecycleEvent[] = [];
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
      eventPublisher: {
        publish: async (event) => {
          events.push(event);
        },
      },
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });

    expect(issued.ok).toBeTrue();
    if (!issued.ok) {
      throw new Error("Expected session issue success.");
    }

    expect(issued.value.session.status).toBe(IdentitySessionStatuses.active);
    expect(issued.value.tokenType).toBe("Bearer");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      eventType: IdentityLifecycleEventTypes.sessionCreated,
      payload: expect.objectContaining({
        sessionId: issued.value.session.id,
        userIdentityId: "user:1",
      }),
    }));

    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) {
      throw new Error("Expected token lookup success.");
    }
    expect(resolved.value.session.id).toBe(issued.value.session.id);
  });

  it("invalidates token material and revokes session through token invalidation", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.desktop,
    });
    if (!issued.ok) {
      throw new Error("Expected session issue success.");
    }

    const invalidated = await service.invalidateAuthenticatedSession({
      token: issued.value.token,
      reason: SessionRevocationReasons.logout,
    });
    expect(invalidated.ok).toBeTrue();
    if (!invalidated.ok) {
      throw new Error("Expected invalidation success.");
    }
    expect(invalidated.value.session.status).toBe(IdentitySessionStatuses.revoked);

    const material = await adapter.getSessionTokenMaterialBySessionId(invalidated.value.session.id);
    expect(material?.invalidatedAt).toBeDefined();

    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeFalse();
  });

  it("expires due sessions when resolving by token and marks token invalidated", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
      policies: {
        desktop: {
          ttlMinutes: 1,
          allowRefresh: false,
        },
        thinClient: {
          ttlMinutes: 1,
          allowRefresh: true,
        },
      },
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });
    if (!issued.ok) {
      throw new Error("Expected session issue success.");
    }

    adapter.setNow("2026-04-04T12:02:00.000Z");
    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeFalse();

    const session = await adapter.getSessionById(issued.value.session.id);
    expect(session?.status).toBe(IdentitySessionStatuses.expired);

    const material = await adapter.getSessionTokenMaterialBySessionId(issued.value.session.id);
    expect(material?.invalidatedAt).toBe("2026-04-04T12:02:00.000Z");
  });

  it("revokes sessions by id and invalidates token material", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });
    if (!issued.ok) {
      throw new Error("Expected issue success.");
    }

    const revoked = await service.revokeAuthenticatedSessionById({
      sessionId: issued.value.session.id,
      reason: SessionRevocationReasons.security,
    });
    expect(revoked.ok).toBeTrue();
    if (!revoked.ok) {
      throw new Error("Expected session revoke success.");
    }
    expect(revoked.value.session.status).toBe(IdentitySessionStatuses.revoked);

    const material = await adapter.getSessionTokenMaterialBySessionId(issued.value.session.id);
    expect(material?.invalidatedAt).toBeDefined();

    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeFalse();
  });

  it("applies inactivity timeout as rolling expiry during token resolution", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
      policies: {
        desktop: {
          ttlMinutes: 60,
          allowRefresh: false,
          inactivityTimeoutMinutes: 5,
        },
        thinClient: {
          ttlMinutes: 60,
          allowRefresh: true,
          inactivityTimeoutMinutes: 5,
        },
      },
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });
    if (!issued.ok) {
      throw new Error("Expected issue success.");
    }

    expect(issued.value.session.expiresAt).toBe("2026-04-04T12:05:00.000Z");

    adapter.setNow("2026-04-04T12:03:00.000Z");
    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) {
      throw new Error("Expected resolve success.");
    }
    expect(resolved.value.session.expiresAt).toBe("2026-04-04T12:08:00.000Z");

    const tokenMaterial = await adapter.getSessionTokenMaterialBySessionId(issued.value.session.id);
    expect(tokenMaterial?.updatedAt).toBe("2026-04-04T12:03:00.000Z");
    expect(tokenMaterial?.expiresAt).toBe("2026-04-04T12:08:00.000Z");
  });

  it("expires sessions when inactivity timeout window elapses without activity", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
      policies: {
        desktop: {
          ttlMinutes: 60,
          allowRefresh: false,
          inactivityTimeoutMinutes: 5,
        },
        thinClient: {
          ttlMinutes: 60,
          allowRefresh: true,
          inactivityTimeoutMinutes: 5,
        },
      },
    });
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });
    if (!issued.ok) {
      throw new Error("Expected issue success.");
    }

    adapter.setNow("2026-04-04T12:06:00.000Z");
    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeFalse();

    const expired = await adapter.getSessionById(issued.value.session.id);
    expect(expired?.status).toBe(IdentitySessionStatuses.expired);
  });

  it("supports optional trust-evaluation seam during token resolution", async () => {
    const adapter = new InMemoryIdentitySessionAdapter();
    const lifecycleService = new IdentitySessionLifecycleService({
      sessionRepository: adapter,
      clock: adapter,
      idGenerator: adapter,
    });
    const trustEvaluator: IIdentitySessionTrustEvaluator = {
      evaluateSessionTrust: async () => Object.freeze({
        allowed: false as const,
        reason: "device not trusted",
        details: Object.freeze({ policy: "future-device-trust" }),
      }),
    };
    const service = new IdentityAuthenticatedSessionService({
      lifecycleService,
      sessionRepository: adapter,
      tokenMaterialRepository: adapter,
      tokenService: adapter,
      clock: adapter,
      sessionTrustEvaluator: trustEvaluator,
    });

    const issued = await service.issueAuthenticatedSession({
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice",
      accessChannel: IdentitySessionAccessChannels.thinClient,
    });
    if (!issued.ok) {
      throw new Error("Expected issue success.");
    }

    const resolved = await service.resolveAuthenticatedSessionByToken({ token: issued.value.token });
    expect(resolved.ok).toBeFalse();
    if (resolved.ok) {
      throw new Error("Expected trust evaluation to reject session.");
    }
    expect(resolved.error.code).toBe(IdentityErrorCodes.invalidSessionState);
    expect(resolved.error.details).toEqual({ policy: "future-device-trust" });
  });
});
