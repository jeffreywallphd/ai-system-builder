import { createHash, randomBytes } from "node:crypto";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import {
  WorkspaceDomainError,
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  createWorkspaceInvitation,
  type WorkspaceInvitation,
  type WorkspaceRole,
} from "@domain/workspaces/WorkspaceDomain";
import {
  WorkspaceIdNamespaces,
  type WorkspaceIdNamespace,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import {
  WorkspaceAdministrationAuditEventTypes,
  publishWorkspaceAdministrationAuditEventBestEffort,
  type WorkspaceAdministrationAuditSink,
} from "./WorkspaceAdministrationAudit";

export const WorkspaceInvitationIssuanceErrorCodes = Object.freeze({
  invalidRequest: "workspace-invitation-issue-invalid-request",
  forbidden: "workspace-invitation-issue-forbidden",
  notFound: "workspace-invitation-issue-not-found",
  conflict: "workspace-invitation-issue-conflict",
  invalidState: "workspace-invitation-issue-invalid-state",
});

export type WorkspaceInvitationIssuanceErrorCode =
  typeof WorkspaceInvitationIssuanceErrorCodes[keyof typeof WorkspaceInvitationIssuanceErrorCodes];

export interface WorkspaceInvitationIssuanceError {
  readonly code: WorkspaceInvitationIssuanceErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceInvitationTokenReference {
  readonly token: string;
  readonly tokenHash: string;
  readonly tokenHint: string;
}

export interface WorkspaceInvitationTokenIssuer {
  issueTokenReference(): WorkspaceInvitationTokenReference;
}

export class Sha256WorkspaceInvitationTokenIssuer implements WorkspaceInvitationTokenIssuer {
  public issueTokenReference(): WorkspaceInvitationTokenReference {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

    return Object.freeze({
      token,
      tokenHash,
      tokenHint: token.slice(-8),
    });
  }
}

export interface WorkspaceInvitationIssuanceClock {
  now(): Date;
}

export interface WorkspaceInvitationIssuanceIdGenerator {
  nextId(namespace: WorkspaceIdNamespace): string;
}

export interface IssueWorkspaceInvitationUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly invitedEmail: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly expiresAt?: string;
  readonly expiresInMs?: number;
  readonly targetUserIdentityIdHint?: string;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}

export interface IssueWorkspaceInvitationUseCaseResult {
  readonly invitation: WorkspaceInvitation;
  readonly invitationToken: string;
}

export type IssueWorkspaceInvitationUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: IssueWorkspaceInvitationUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceInvitationIssuanceError;
  };

interface IssueWorkspaceInvitationUseCaseDependencies {
  readonly invitationRepository: IWorkspaceInvitationRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly idGenerator: WorkspaceInvitationIssuanceIdGenerator;
  readonly tokenIssuer: WorkspaceInvitationTokenIssuer;
  readonly clock: WorkspaceInvitationIssuanceClock;
  readonly defaultInvitationTtlMs?: number;
  readonly maxInvitationTtlMs?: number;
  readonly auditSink?: WorkspaceAdministrationAuditSink;
}

export class IssueWorkspaceInvitationUseCase {
  private readonly defaultInvitationTtlMs: number;
  private readonly maxInvitationTtlMs: number;

  public constructor(private readonly dependencies: IssueWorkspaceInvitationUseCaseDependencies) {
    this.maxInvitationTtlMs = normalizeDuration(
      dependencies.maxInvitationTtlMs,
      30 * 24 * 60 * 60 * 1_000,
    );
    this.defaultInvitationTtlMs = Math.min(
      normalizeDuration(
        dependencies.defaultInvitationTtlMs,
        7 * 24 * 60 * 60 * 1_000,
      ),
      this.maxInvitationTtlMs,
    );
  }

  public async execute(input: IssueWorkspaceInvitationUseCaseInput): Promise<IssueWorkspaceInvitationUseCaseOutcome> {
    const workspaceId = normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceInvitationIssuanceErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const invitedEmail = normalizeRequired(input.invitedEmail);
    if (!invitedEmail) {
      return this.failure(WorkspaceInvitationIssuanceErrorCodes.invalidRequest, "invitedEmail is required.");
    }

    if (!Array.isArray(input.invitedRoles) || input.invitedRoles.length === 0) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
        "invitedRoles must include at least one role.",
      );
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: nowIso,
    });

    if (!snapshot) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    const canAdministrate = snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    if (!canAdministrate) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.forbidden,
        "Actor must have owner or admin role to issue invitations.",
      );
    }

    const pendingByEmail = await this.dependencies.invitationRepository.findPendingInvitationByEmail({
      workspaceId,
      invitedEmail,
      asOf: nowIso,
    });
    if (pendingByEmail) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.conflict,
        `An active pending invitation already exists for '${pendingByEmail.invitedEmail}' in workspace '${workspaceId}'.`,
        {
          invitationId: pendingByEmail.id,
          expiresAt: pendingByEmail.expiresAt,
        },
      );
    }

    const invitationId = this.dependencies.idGenerator.nextId(WorkspaceIdNamespaces.workspaceInvitation);
    if (!normalizeRequired(invitationId)) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidState,
        "Id generator returned an empty workspace invitation id.",
      );
    }

    const tokenReference = this.dependencies.tokenIssuer.issueTokenReference();
    if (!normalizeRequired(tokenReference.token) || !normalizeRequired(tokenReference.tokenHash)) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidState,
        "Token issuer returned an invalid invitation token reference.",
      );
    }

    const duplicatePendingToken = await this.dependencies.invitationRepository.findPendingInvitationByTokenHash({
      workspaceId,
      invitationTokenHash: tokenReference.tokenHash,
      asOf: nowIso,
    });
    if (duplicatePendingToken) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidState,
        "Token issuer produced a duplicate pending invitation token hash.",
      );
    }

    const expiresAt = this.resolveExpiration(input, now);
    if (!expiresAt.ok) {
      return expiresAt.outcome;
    }

    let invitation: WorkspaceInvitation;
    try {
      invitation = createWorkspaceInvitation({
        id: invitationId,
        workspaceId,
        invitedEmail,
        invitedByUserId: actorUserIdentityId,
        invitedRoles: input.invitedRoles,
        invitationTokenHash: tokenReference.tokenHash,
        invitationTokenHint: normalizeOptional(tokenReference.tokenHint),
        targetUserIdentityIdHint: normalizeOptional(input.targetUserIdentityIdHint),
        onboardingMetadata: normalizeMetadata(input.onboardingMetadata),
        status: WorkspaceInvitationStatuses.pending,
        createdAt: nowIso,
        expiresAt: expiresAt.expiresAt,
        lastModifiedBy: actorUserIdentityId,
        lastModifiedAt: nowIso,
      });
    } catch (error) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Invitation issuance input is invalid.",
      );
    }

    const persist = async (): Promise<void> => {
      await this.dependencies.invitationRepository.saveInvitation(invitation);
    };

    try {
      if (this.dependencies.transactionManager) {
        await this.dependencies.transactionManager.runInTransaction(persist);
      } else {
        await persist();
      }
    } catch (error) {
      return this.failure(
        WorkspaceInvitationIssuanceErrorCodes.invalidState,
        `Workspace invitation issuance failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    await publishWorkspaceAdministrationAuditEventBestEffort(this.dependencies.auditSink, {
      type: WorkspaceAdministrationAuditEventTypes.invitationIssued,
      workspaceId,
      actorUserIdentityId,
      occurredAt: nowIso,
      details: Object.freeze({
        invitationId: invitation.id,
        invitedEmail: invitation.invitedEmail,
        invitedRoles: invitation.invitedRoles,
        expiresAt: invitation.expiresAt,
        targetUserIdentityIdHint: invitation.targetUserIdentityIdHint,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        invitation,
        invitationToken: tokenReference.token,
      }),
    };
  }

  private resolveExpiration(
    input: IssueWorkspaceInvitationUseCaseInput,
    now: Date,
  ):
    | { readonly ok: true; readonly expiresAt: string }
    | { readonly ok: false; readonly outcome: IssueWorkspaceInvitationUseCaseOutcome } {
    if (input.expiresAt && input.expiresInMs !== undefined) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
          "Provide either expiresAt or expiresInMs, not both.",
        ),
      };
    }

    if (input.expiresAt) {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return {
          ok: false,
          outcome: this.failure(
            WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
            "expiresAt must be a valid ISO timestamp.",
          ),
        };
      }

      const ttl = parsed.getTime() - now.getTime();
      if (ttl <= 0) {
        return {
          ok: false,
          outcome: this.failure(
            WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
            "expiresAt must be later than the issuance timestamp.",
          ),
        };
      }

      if (ttl > this.maxInvitationTtlMs) {
        return {
          ok: false,
          outcome: this.failure(
            WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
            `expiresAt exceeds maximum allowed invitation lifetime of ${this.maxInvitationTtlMs}ms.`,
          ),
        };
      }

      return {
        ok: true,
        expiresAt: parsed.toISOString(),
      };
    }

    const ttl = input.expiresInMs === undefined
      ? this.defaultInvitationTtlMs
      : input.expiresInMs;

    if (!Number.isInteger(ttl) || ttl <= 0) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
          "expiresInMs must be a positive integer when provided.",
        ),
      };
    }

    if (ttl > this.maxInvitationTtlMs) {
      return {
        ok: false,
        outcome: this.failure(
          WorkspaceInvitationIssuanceErrorCodes.invalidRequest,
          `expiresInMs exceeds maximum allowed invitation lifetime of ${this.maxInvitationTtlMs}ms.`,
        ),
      };
    }

    return {
      ok: true,
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
    };
  }

  private failure(
    code: WorkspaceInvitationIssuanceErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): IssueWorkspaceInvitationUseCaseOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeMetadata(
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  if (!metadata) {
    return undefined;
  }

  return Object.keys(metadata).length > 0
    ? Object.freeze({ ...metadata })
    : undefined;
}

function normalizeDuration(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return fallback;
  }
  return value as number;
}

