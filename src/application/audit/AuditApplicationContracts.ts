import type {
  CanonicalAuditEvent,
  AuditEventCategory,
} from "@domain/audit/AuditDomain";
import {
  AuditEventCategories,
  AuditRecordKinds,
} from "@domain/audit/AuditDomain";
import type {
  AuditLedgerAppendContext,
  IAuditLedgerRepository,
} from "./ports/AuditLedgerPersistencePorts";
export type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "./ports/AuditLedgerPersistencePorts";

export const AuditLedgerStreamKinds = Object.freeze({
  audit: "audit",
  operational: "operational",
});

export type AuditLedgerStreamKind = typeof AuditLedgerStreamKinds[keyof typeof AuditLedgerStreamKinds];

export interface IOperationalEventLogRepository {
  appendOperationalEvent(input: {
    readonly channel: "operational";
    readonly eventType: string;
    readonly occurredAt: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

export const AuditActionCategoryHints = Object.freeze([
  Object.freeze({ prefix: "auth.", category: AuditEventCategories.securitySensitive }),
  Object.freeze({ prefix: "identity.", category: AuditEventCategories.securitySensitive }),
  Object.freeze({ prefix: "security.", category: AuditEventCategories.securitySensitive }),
  Object.freeze({ prefix: "workspace.", category: AuditEventCategories.administrative }),
  Object.freeze({ prefix: "node.", category: AuditEventCategories.administrative }),
  Object.freeze({ prefix: "storage.", category: AuditEventCategories.administrative }),
  Object.freeze({ prefix: "share.", category: AuditEventCategories.sharing }),
  Object.freeze({ prefix: "permission.", category: AuditEventCategories.sharing }),
  Object.freeze({ prefix: "policy.", category: AuditEventCategories.policy }),
  Object.freeze({ prefix: "retention.", category: AuditEventCategories.policy }),
  Object.freeze({ prefix: "run.", category: AuditEventCategories.orchestration }),
  Object.freeze({ prefix: "scheduling.", category: AuditEventCategories.orchestration }),
  Object.freeze({ prefix: "secret.", category: AuditEventCategories.protectedData }),
  Object.freeze({ prefix: "asset.protected.", category: AuditEventCategories.protectedData }),
]);

export function resolveAuditCategoryForAction(action: string): AuditEventCategory {
  const normalizedAction = action.trim().toLowerCase();
  for (const hint of AuditActionCategoryHints) {
    if (normalizedAction.startsWith(hint.prefix)) {
      return hint.category;
    }
  }

  return AuditEventCategories.administrative;
}

export function isAuditRecordEvent(input: { readonly recordKind: string }): boolean {
  return input.recordKind === AuditRecordKinds.auditRecord;
}

export function isOperationalLogEvent(input: { readonly recordKind: string }): boolean {
  return input.recordKind === AuditRecordKinds.operationalLog;
}

export async function appendAuditEventBestEffort(
  repository: IAuditLedgerRepository | undefined,
  event: CanonicalAuditEvent,
  context: AuditLedgerAppendContext,
): Promise<void> {
  if (!repository) {
    return;
  }

  try {
    await repository.appendAuditEvent(event, context);
  } catch {
    // Intentionally best-effort for application emission points until durable fan-out is centralized.
  }
}
