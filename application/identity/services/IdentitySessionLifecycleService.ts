import {
  IdentitySessionAccessChannels,
  IdentitySessionStatuses,
  createSession,
  expireSession,
  revokeSession,
  rotateSession,
  type IdentitySessionAccessChannel,
  type Session,
  type SessionRevocationReason,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityErrorBoundaries,
  type IdentityErrorCode,
  IdentityErrorCodes,
  IdentityIdNamespaces,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";

export interface IdentitySessionLifecyclePolicy {
  readonly ttlMinutes: number;
  readonly allowRefresh: boolean;
  readonly inactivityTimeoutMinutes?: number;
}

export interface IdentitySessionLifecyclePolicies {
  readonly [IdentitySessionAccessChannels.desktop]: IdentitySessionLifecyclePolicy;
  readonly [IdentitySessionAccessChannels.thinClient]: IdentitySessionLifecyclePolicy;
}

export interface IssueIdentitySessionInput {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly accessChannel: IdentitySessionAccessChannel;
  readonly client?: {
    readonly userAgent?: string;
    readonly ipAddress?: string;
    readonly deviceId?: string;
  };
}

export interface IssueIdentitySessionResult {
  readonly session: Session;
  readonly policy: IdentitySessionLifecyclePolicy;
}

export interface RefreshIdentitySessionInput {
  readonly sessionId: string;
}

export interface RefreshIdentitySessionResult {
  readonly priorSession: Session;
  readonly refreshedSession: Session;
}

export interface RevokeIdentitySessionInput {
  readonly sessionId: string;
  readonly reason: SessionRevocationReason;
}

export interface RevokeIdentitySessionResult {
  readonly session: Session;
}

export interface ExpireDueIdentitySessionsInput {
  readonly userIdentityId: string;
}

export interface ExpireDueIdentitySessionsResult {
  readonly expiredSessionIds: ReadonlyArray<string>;
}

interface IdentitySessionLifecycleServiceDependencies {
  readonly sessionRepository: IIdentitySessionRepository;
  readonly clock: IIdentityClock;
  readonly idGenerator: IIdentityIdGenerator;
  readonly policies?: IdentitySessionLifecyclePolicies;
}

const DEFAULT_POLICIES: IdentitySessionLifecyclePolicies = Object.freeze({
  [IdentitySessionAccessChannels.desktop]: Object.freeze({
    ttlMinutes: 60 * 24 * 30,
    allowRefresh: false,
  }),
  [IdentitySessionAccessChannels.thinClient]: Object.freeze({
    ttlMinutes: 60 * 12,
    allowRefresh: true,
  }),
});

export class IdentitySessionLifecycleService {
  private readonly policies: IdentitySessionLifecyclePolicies;

  public constructor(private readonly dependencies: IdentitySessionLifecycleServiceDependencies) {
    this.policies = dependencies.policies ?? DEFAULT_POLICIES;
    assertPoliciesAreValid(this.policies);
  }

  public getPolicies(): IdentitySessionLifecyclePolicies {
    return this.policies;
  }

  public getPolicyForAccessChannel(accessChannel: IdentitySessionAccessChannel): IdentitySessionLifecyclePolicy | undefined {
    return this.resolvePolicy(accessChannel);
  }

  public calculateSessionAbsoluteExpiry(
    issuedAt: Date,
    accessChannel: IdentitySessionAccessChannel,
  ): Date | undefined {
    const policy = this.resolvePolicy(accessChannel);
    if (!policy) {
      return undefined;
    }

    return new Date(issuedAt.getTime() + (policy.ttlMinutes * 60_000));
  }

  public calculateSessionRollingExpiry(
    issuedAt: Date,
    accessChannel: IdentitySessionAccessChannel,
    lastActivityAt?: Date,
  ): Date | undefined {
    const policy = this.resolvePolicy(accessChannel);
    if (!policy) {
      return undefined;
    }

    const absoluteExpiry = new Date(issuedAt.getTime() + (policy.ttlMinutes * 60_000));
    const anchor = lastActivityAt ?? issuedAt;
    if (!policy.inactivityTimeoutMinutes) {
      return absoluteExpiry;
    }

    const inactivityExpiry = new Date(anchor.getTime() + (policy.inactivityTimeoutMinutes * 60_000));
    return inactivityExpiry.getTime() < absoluteExpiry.getTime() ? inactivityExpiry : absoluteExpiry;
  }

  public async issueSession(
    input: IssueIdentitySessionInput,
  ): Promise<IdentityOperationResult<IssueIdentitySessionResult, typeof IdentityErrorCodes.invalidRequest>> {
    const userIdentityId = normalizeRequired(input.userIdentityId);
    const providerId = normalizeRequired(input.providerId);
    const providerSubject = normalizeRequired(input.providerSubject);
    if (!userIdentityId || !providerId || !providerSubject) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        "Session issuance requires userIdentityId, providerId, and providerSubject.",
      );
    }

    const policy = this.resolvePolicy(input.accessChannel);
    if (!policy) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        `Unsupported session access channel '${String(input.accessChannel)}'.`,
      );
    }

    const issuedAt = this.dependencies.clock.now();
    const expiresAt = this.calculateSessionRollingExpiry(issuedAt, input.accessChannel, issuedAt);
    if (!expiresAt) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        `Unsupported session access channel '${String(input.accessChannel)}'.`,
      );
    }
    const session = createSession({
      id: this.dependencies.idGenerator.nextId(IdentityIdNamespaces.identitySession),
      userIdentityId,
      providerId,
      providerSubject,
      issuedAt,
      expiresAt,
      client: {
        accessChannel: input.accessChannel,
        userAgent: input.client?.userAgent,
        ipAddress: input.client?.ipAddress,
        deviceId: input.client?.deviceId,
      },
    });

    const persisted = await this.dependencies.sessionRepository.saveSession(session);
    return identitySuccess(Object.freeze({
      session: persisted,
      policy,
    }));
  }

  public async refreshSession(
    input: RefreshIdentitySessionInput,
  ): Promise<IdentityOperationResult<RefreshIdentitySessionResult, typeof IdentityErrorCodes.invalidSessionState | typeof IdentityErrorCodes.notFound>> {
    const sessionId = normalizeRequired(input.sessionId);
    if (!sessionId) {
      return this.failure(IdentityErrorCodes.invalidSessionState, "Session refresh requires a sessionId.");
    }

    const current = await this.dependencies.sessionRepository.getSessionById(sessionId);
    if (!current) {
      return this.failure(IdentityErrorCodes.notFound, `Session '${sessionId}' was not found.`);
    }
    if (current.status !== IdentitySessionStatuses.active) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        `Session '${sessionId}' is not active and cannot be refreshed.`,
      );
    }

    const now = this.dependencies.clock.now();
    if (now.getTime() >= new Date(current.expiresAt).getTime()) {
      const expired = expireSession(current, now);
      await this.dependencies.sessionRepository.saveSession(expired);
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        `Session '${sessionId}' is expired and cannot be refreshed.`,
      );
    }

    const accessChannel = current.client?.accessChannel ?? IdentitySessionAccessChannels.thinClient;
    const policy = this.resolvePolicy(accessChannel);
    if (!policy || !policy.allowRefresh) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        `Session '${sessionId}' does not allow refresh for access channel '${accessChannel}'.`,
      );
    }

    const refreshedSessionId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.identitySession);
    const refreshed = createSession({
      id: refreshedSessionId,
      userIdentityId: current.userIdentityId,
      providerId: current.providerId,
      providerSubject: current.providerSubject,
      issuedAt: now,
      expiresAt: this.calculateSessionRollingExpiry(now, accessChannel, now) ?? new Date(now.getTime() + (policy.ttlMinutes * 60_000)),
      client: current.client,
    });
    const rotated = rotateSession(current, refreshedSessionId, now);

    await this.dependencies.sessionRepository.saveSession(rotated);
    const persistedRefreshed = await this.dependencies.sessionRepository.saveSession(refreshed);

    return identitySuccess(Object.freeze({
      priorSession: rotated,
      refreshedSession: persistedRefreshed,
    }));
  }

  public async revokeSession(
    input: RevokeIdentitySessionInput,
  ): Promise<IdentityOperationResult<RevokeIdentitySessionResult, typeof IdentityErrorCodes.invalidSessionState | typeof IdentityErrorCodes.notFound>> {
    const sessionId = normalizeRequired(input.sessionId);
    if (!sessionId) {
      return this.failure(IdentityErrorCodes.invalidSessionState, "Session revocation requires a sessionId.");
    }

    const current = await this.dependencies.sessionRepository.getSessionById(sessionId);
    if (!current) {
      return this.failure(IdentityErrorCodes.notFound, `Session '${sessionId}' was not found.`);
    }
    if (current.status !== IdentitySessionStatuses.active) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        `Session '${sessionId}' is not active and cannot be revoked.`,
      );
    }

    const revoked = revokeSession(current, input.reason, this.dependencies.clock.now());
    const persisted = await this.dependencies.sessionRepository.saveSession(revoked);
    return identitySuccess(Object.freeze({ session: persisted }));
  }

  public async expireDueSessions(
    input: ExpireDueIdentitySessionsInput,
  ): Promise<IdentityOperationResult<ExpireDueIdentitySessionsResult, typeof IdentityErrorCodes.invalidRequest>> {
    const userIdentityId = normalizeRequired(input.userIdentityId);
    if (!userIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "Session expiry sweep requires userIdentityId.");
    }

    const now = this.dependencies.clock.now();
    const due = await this.dependencies.sessionRepository.listSessionsByUserIdentityId({
      userIdentityId,
      includeStatuses: [IdentitySessionStatuses.active],
      expiresBefore: new Date(now.getTime() + 1).toISOString(),
    });

    const expiredIds: string[] = [];
    for (const session of due) {
      const expired = expireSession(session, now);
      await this.dependencies.sessionRepository.saveSession(expired);
      expiredIds.push(expired.id);
    }

    return identitySuccess(Object.freeze({
      expiredSessionIds: Object.freeze(expiredIds),
    }));
  }

  private resolvePolicy(accessChannel: IdentitySessionAccessChannel): IdentitySessionLifecyclePolicy | undefined {
    if (!Object.values(IdentitySessionAccessChannels).includes(accessChannel)) {
      return undefined;
    }
    return this.policies[accessChannel];
  }

  private failure<TValue, TCode extends IdentityErrorCode>(
    code: TCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): IdentityOperationResult<TValue, TCode> {
    const error: IdentityOperationError<TCode> = Object.freeze({
      code,
      message,
      boundary: IdentityErrorBoundaries.application,
      retryable: false,
      details,
    });
    return identityFailure(error);
  }
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function assertPoliciesAreValid(policies: IdentitySessionLifecyclePolicies): void {
  for (const channel of Object.values(IdentitySessionAccessChannels)) {
    const policy = policies[channel];
    if (!policy) {
      throw new Error(`Identity session lifecycle policy for '${channel}' is required.`);
    }
    if (!Number.isInteger(policy.ttlMinutes) || policy.ttlMinutes < 1) {
      throw new Error(`Identity session lifecycle policy for '${channel}' requires ttlMinutes >= 1.`);
    }
    if (typeof policy.allowRefresh !== "boolean") {
      throw new Error(`Identity session lifecycle policy for '${channel}' requires boolean allowRefresh.`);
    }
    if (policy.inactivityTimeoutMinutes !== undefined) {
      if (!Number.isInteger(policy.inactivityTimeoutMinutes) || policy.inactivityTimeoutMinutes < 1) {
        throw new Error(
          `Identity session lifecycle policy for '${channel}' requires inactivityTimeoutMinutes >= 1 when configured.`,
        );
      }
      if (policy.inactivityTimeoutMinutes > policy.ttlMinutes) {
        throw new Error(
          `Identity session lifecycle policy for '${channel}' requires inactivityTimeoutMinutes <= ttlMinutes.`,
        );
      }
    }
  }
}
