import {
  SecretAccessActions,
  SecretScopes,
  createSecretScopeOwner,
  type SecretAccessActor,
  type SecretScopeOwner,
} from "@domain/security/SecretDomain";
import type {
  ISecretAccessPolicyPort,
  ISecretRecordPersistenceRepository,
} from "../ports/SecretServicePorts";
import {
  SecretServiceErrorCodes,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export const SecretScopeResolutionModes = Object.freeze({
  exactScope: "exact-scope",
  explicitFallbackChain: "explicit-fallback-chain",
});

export type SecretScopeResolutionMode =
  typeof SecretScopeResolutionModes[keyof typeof SecretScopeResolutionModes];

export const SecretScopeDuplicateMatchPolicies = Object.freeze({
  fail: "fail",
  firstMatch: "first-match",
});

export type SecretScopeDuplicateMatchPolicy =
  typeof SecretScopeDuplicateMatchPolicies[keyof typeof SecretScopeDuplicateMatchPolicies];

export const SecretScopeResolutionOutcomes = Object.freeze({
  resolved: "resolved",
  notFound: "not-found",
  ambiguous: "ambiguous",
});

export type SecretScopeResolutionOutcome =
  typeof SecretScopeResolutionOutcomes[keyof typeof SecretScopeResolutionOutcomes];

export interface SecretScopeResolutionPolicy {
  readonly mode: SecretScopeResolutionMode;
  readonly owners: ReadonlyArray<SecretScopeOwner>;
  readonly duplicateMatchPolicy?: SecretScopeDuplicateMatchPolicy;
}

export interface ResolveSecretByScopeRequest {
  readonly actor: SecretAccessActor;
  readonly name: string;
  readonly policy: SecretScopeResolutionPolicy;
  readonly occurredAt?: string;
}

export type ResolveSecretByScopeResult =
  | {
    readonly outcome: typeof SecretScopeResolutionOutcomes.resolved;
    readonly secret: {
      readonly secretId: string;
      readonly name: string;
      readonly scope: SecretScopeOwner["scope"];
      readonly workspaceId?: string;
      readonly userIdentityId?: string;
    };
    readonly matchedOwner: SecretScopeOwner;
    readonly attemptedOwners: ReadonlyArray<SecretScopeOwner>;
  }
  | {
    readonly outcome: typeof SecretScopeResolutionOutcomes.notFound;
    readonly attemptedOwners: ReadonlyArray<SecretScopeOwner>;
  }
  | {
    readonly outcome: typeof SecretScopeResolutionOutcomes.ambiguous;
    readonly attemptedOwners: ReadonlyArray<SecretScopeOwner>;
    readonly matchedSecretIds: ReadonlyArray<string>;
  };

export interface SecretScopeResolverDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly now?: () => Date;
}

export class SecretScopeResolver {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: SecretScopeResolverDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async resolveSecretByScope(
    request: ResolveSecretByScopeRequest,
  ): Promise<SecretServiceResult<ResolveSecretByScopeResult>> {
    const actorId = request.actor?.actorId?.trim();
    if (!actorId) {
      return invalidRequest("actor.actorId is required.");
    }

    const name = request.name?.trim();
    if (!name) {
      return invalidRequest("name is required.");
    }

    const occurredAt = normalizeTimestamp(request.occurredAt, this.now);
    if (!occurredAt) {
      return invalidRequest("occurredAt must be a valid timestamp when provided.");
    }

    if (!Object.values(SecretScopeResolutionModes).includes(request.policy?.mode)) {
      return invalidRequest(`Secret scope resolution mode '${String(request.policy?.mode)}' is invalid.`);
    }

    const duplicateMatchPolicy = request.policy.duplicateMatchPolicy ?? SecretScopeDuplicateMatchPolicies.fail;
    if (!Object.values(SecretScopeDuplicateMatchPolicies).includes(duplicateMatchPolicy)) {
      return invalidRequest(`Secret scope duplicateMatchPolicy '${String(duplicateMatchPolicy)}' is invalid.`);
    }

    if (!request.policy.owners || request.policy.owners.length === 0) {
      return invalidRequest("policy.owners must include at least one scope owner.");
    }

    if (request.policy.mode === SecretScopeResolutionModes.exactScope && request.policy.owners.length !== 1) {
      return invalidRequest("exact-scope mode requires exactly one owner.");
    }

    let owners: ReadonlyArray<SecretScopeOwner>;
    try {
      owners = normalizeOwners(request.policy.owners);
    } catch (error) {
      return invalidRequest(toErrorMessage(error));
    }

    const unauthorizedOwner = await this.findUnauthorizedOwner(request.actor, owners, occurredAt);
    if (unauthorizedOwner) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Actor '${actorId}' is not allowed to resolve secrets for the requested scope owner.`,
          details: Object.freeze({
            scope: unauthorizedOwner.scope,
            workspaceId: unauthorizedOwner.workspaceId,
            userIdentityId: unauthorizedOwner.userIdentityId,
            reason: unauthorizedOwner.reason,
          }),
        }),
      };
    }

    const matchedRecords = [];
    for (const owner of owners) {
      const record = await this.dependencies.secretRecordRepository.findSecretByNameAndScope({
        name,
        owner,
      });
      if (record) {
        matchedRecords.push(record);
      }
    }

    if (matchedRecords.length === 0) {
      return {
        ok: true,
        value: Object.freeze({
          outcome: SecretScopeResolutionOutcomes.notFound,
          attemptedOwners: owners,
        }),
      };
    }

    if (matchedRecords.length > 1 && duplicateMatchPolicy === SecretScopeDuplicateMatchPolicies.fail) {
      return {
        ok: true,
        value: Object.freeze({
          outcome: SecretScopeResolutionOutcomes.ambiguous,
          attemptedOwners: owners,
          matchedSecretIds: Object.freeze(matchedRecords.map((record) => record.secretId)),
        }),
      };
    }

    const selectedRecord = matchedRecords[0];
    const selectedOwner = selectedRecord.owner;
    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.readMetadata,
      actor: request.actor,
      owner: selectedOwner,
      record: selectedRecord,
      occurredAt,
    });

    if (!decision.allowed) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Secret scope resolution denied (${decision.reason}).`,
          details: Object.freeze({
            secretId: selectedRecord.secretId,
            scope: selectedOwner.scope,
            workspaceId: selectedOwner.workspaceId,
            userIdentityId: selectedOwner.userIdentityId,
          }),
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        outcome: SecretScopeResolutionOutcomes.resolved,
        secret: Object.freeze({
          secretId: selectedRecord.secretId,
          name: selectedRecord.reference.name,
          scope: selectedOwner.scope,
          workspaceId: selectedOwner.workspaceId,
          userIdentityId: selectedOwner.userIdentityId,
        }),
        matchedOwner: selectedOwner,
        attemptedOwners: owners,
      }),
    };
  }

  private async findUnauthorizedOwner(
    actor: SecretAccessActor,
    owners: ReadonlyArray<SecretScopeOwner>,
    occurredAt: string,
  ): Promise<(SecretScopeOwner & { readonly reason: string }) | undefined> {
    for (const owner of owners) {
      const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
        action: SecretAccessActions.readMetadata,
        actor,
        owner,
        occurredAt,
      });
      if (!decision.allowed) {
        return Object.freeze({
          ...owner,
          reason: decision.reason,
        });
      }
    }
    return undefined;
  }
}

function normalizeOwners(input: ReadonlyArray<SecretScopeOwner>): ReadonlyArray<SecretScopeOwner> {
  const seen = new Set<string>();
  const owners: SecretScopeOwner[] = [];

  for (const owner of input) {
    const normalized = createSecretScopeOwner(owner);
    const key = createOwnerKey(normalized);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    owners.push(normalized);
  }

  return Object.freeze(owners);
}

function createOwnerKey(owner: SecretScopeOwner): string {
  if (owner.scope === SecretScopes.server) {
    return "server";
  }

  if (owner.scope === SecretScopes.workspace) {
    return `workspace:${owner.workspaceId ?? ""}`;
  }

  return `user:${owner.workspaceId ?? ""}:${owner.userIdentityId ?? ""}`;
}

function normalizeTimestamp(value: string | undefined, now: () => Date): string | undefined {
  if (!value) {
    return now().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function invalidRequest(message: string): SecretServiceResult<ResolveSecretByScopeResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Secret scope resolution request is invalid.";
}

