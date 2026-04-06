import { SecretAccessActions, toSecretReference } from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretRecordPersistenceRepository,
} from "../ports/SecretServicePorts";
import {
  SecretServiceErrorCodes,
  type GetSecretMetadataRequest,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export interface GetSecretMetadataUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly now?: () => Date;
}

export class GetSecretMetadataUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: GetSecretMetadataUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(request: GetSecretMetadataRequest): Promise<SecretServiceResult<ReturnType<typeof toSecretReference>>> {
    const actorId = request.actor?.actorId?.trim();
    if (!actorId) {
      return invalidRequest("actor.actorId is required.");
    }

    const secretId = request.secretId?.trim();
    if (!secretId) {
      return invalidRequest("secretId is required.");
    }

    const occurredAt = normalizeTimestamp(request.occurredAt, this.now);
    if (!occurredAt) {
      return invalidRequest("occurredAt must be a valid timestamp when provided.");
    }

    const record = await this.dependencies.secretRecordRepository.findSecretById(secretId);
    if (!record) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.notFound,
          message: `Secret '${secretId}' was not found.`,
        }),
      };
    }

    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.readMetadata,
      actor: request.actor,
      owner: record.owner,
      record,
      occurredAt,
    });

    await this.dependencies.secretAccessAuditPort.recordSecretAccessDecision(Object.freeze({
      secretId: record.secretId,
      scope: record.owner.scope,
      action: SecretAccessActions.readMetadata,
      decision: decision.allowed ? "allowed" : "denied",
      reason: decision.reason,
      actorId,
      actorType: request.actor.actorType,
      workspaceId: request.actor.workspaceId,
      userIdentityId: request.actor.userIdentityId,
      occurredAt: decision.occurredAt,
    }));

    if (!decision.allowed) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Secret metadata access denied (${decision.reason}).`,
        }),
      };
    }

    return {
      ok: true,
      value: toSecretReference(record),
    };
  }
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

function invalidRequest(message: string): SecretServiceResult<ReturnType<typeof toSecretReference>> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}
