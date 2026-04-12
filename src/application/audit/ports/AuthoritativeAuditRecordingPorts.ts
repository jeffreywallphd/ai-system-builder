import type {
  AuditActorIdentity,
  AuditEventCategory,
  AuditEventOutcome,
  AuditLifecycleState,
  AuditImmutabilityPosture,
  AuditProtectedResourceReference,
  AuditRedactionReason,
  AuditRetentionAnchorKind,
  AuditRetentionPosture,
  AuditScope,
} from "@domain/audit/AuditDomain";
import type {
  AuthoritativeAuditActionContextInput,
  AuthoritativeAuditLinkageInput,
} from "../shared/AuditReferenceNormalization";
import type {
  AuditLedgerAppendResult,
  IAuditLedgerRepository,
} from "../AuditApplicationContracts";
import type { CanonicalAuditEvent } from "@domain/audit/AuditDomain";
import type { IAuditLedgerWriteObservabilityPort } from "./AuditLedgerObservabilityPorts";

export const AuthoritativeAuditEventSources = Object.freeze({
  identity: "identity",
  nodeTrust: "node-trust",
  sharing: "sharing",
  storage: "storage",
  runs: "runs",
  scheduling: "scheduling",
  secrets: "secrets",
  policy: "policy",
});

export type AuthoritativeAuditEventSource =
  typeof AuthoritativeAuditEventSources[keyof typeof AuthoritativeAuditEventSources];

export interface AuthoritativeAuditStructuredPayload {
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData?: boolean;
  readonly redactionReasons?: ReadonlyArray<AuditRedactionReason>;
}

export interface AuthoritativeAuditRecordEventInput {
  readonly operationKey: string;
  readonly eventType: string;
  readonly action: string;
  readonly outcome: AuditEventOutcome;
  readonly occurredAt: string;
  readonly actor: AuditActorIdentity;
  readonly scope: AuditScope;
  readonly payload?: AuthoritativeAuditStructuredPayload;
  readonly category?: AuditEventCategory;
  readonly protectedResource?: AuditProtectedResourceReference;
  readonly retention?: AuditRetentionPosture;
  readonly retentionMetadata?: Readonly<{
    readonly policyKey?: string;
    readonly policyVersion?: string;
    readonly retentionAnchor?: AuditRetentionAnchorKind;
    readonly retainUntil?: string;
    readonly archiveAfter?: string;
    readonly lifecycleState?: AuditLifecycleState;
    readonly lifecycleUpdatedAt?: string;
  }>;
  readonly immutability?: AuditImmutabilityPosture;
  readonly integrity?: Readonly<{
    readonly schemaVersion?: string;
    readonly hashAlgorithm?: string;
    readonly eventDigest?: string;
    readonly previousEventDigest?: string;
  }>;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly actionContext?: AuthoritativeAuditActionContextInput;
  readonly linkage?: AuthoritativeAuditLinkageInput;
}

export interface AuthoritativeAuditRecordingPort {
  recordIdentityEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordNodeTrustEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordSharingEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordStorageEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordRunsEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordSchedulingEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordSecretsEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
  recordPolicyEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult>;
}

export interface AuthoritativeAuditRecordingServiceDependencies {
  readonly repository: IAuditLedgerRepository;
  readonly observabilityPort?: IAuditLedgerWriteObservabilityPort;
  readonly publicationPort?: {
    publishAuthoritativeAuditEvent(input: {
      readonly source: AuthoritativeAuditEventSource;
      readonly appendResult: AuditLedgerAppendResult;
      readonly event: CanonicalAuditEvent;
    }): Promise<void> | void;
  };
  readonly retentionLifecycleDefaults?: Readonly<{
    readonly policyKey?: string;
    readonly policyVersion?: string;
    readonly retentionAnchor?: AuditRetentionAnchorKind;
  }>;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export const AuthoritativeAuditActionPrefixHintsBySource = Object.freeze({
  [AuthoritativeAuditEventSources.identity]: Object.freeze(["identity.", "auth.", "security."]),
  [AuthoritativeAuditEventSources.nodeTrust]: Object.freeze(["node."]),
  [AuthoritativeAuditEventSources.sharing]: Object.freeze(["share.", "permission."]),
  [AuthoritativeAuditEventSources.storage]: Object.freeze(["storage."]),
  [AuthoritativeAuditEventSources.runs]: Object.freeze(["run."]),
  [AuthoritativeAuditEventSources.scheduling]: Object.freeze(["scheduling."]),
  [AuthoritativeAuditEventSources.secrets]: Object.freeze(["secret.", "asset.protected."]),
  [AuthoritativeAuditEventSources.policy]: Object.freeze(["policy.", "retention."]),
} satisfies Readonly<Record<AuthoritativeAuditEventSource, ReadonlyArray<string>>>);

export function createAuthoritativeAuditFeatureRecorder(
  port: AuthoritativeAuditRecordingPort,
  source: AuthoritativeAuditEventSource,
): (input: AuthoritativeAuditRecordEventInput) => Promise<AuditLedgerAppendResult> {
  if (source === AuthoritativeAuditEventSources.identity) {
    return (input) => port.recordIdentityEvent(input);
  }
  if (source === AuthoritativeAuditEventSources.nodeTrust) {
    return (input) => port.recordNodeTrustEvent(input);
  }
  if (source === AuthoritativeAuditEventSources.sharing) {
    return (input) => port.recordSharingEvent(input);
  }
  if (source === AuthoritativeAuditEventSources.storage) {
    return (input) => port.recordStorageEvent(input);
  }
  if (source === AuthoritativeAuditEventSources.runs) {
    return (input) => port.recordRunsEvent(input);
  }
  if (source === AuthoritativeAuditEventSources.scheduling) {
    return (input) => port.recordSchedulingEvent(input);
  }
  if (source === AuthoritativeAuditEventSources.secrets) {
    return (input) => port.recordSecretsEvent(input);
  }
  return (input) => port.recordPolicyEvent(input);
}
