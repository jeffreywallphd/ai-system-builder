import { randomUUID } from "node:crypto";

export const WebSocketChannelPurposes = Object.freeze({
  status: "status",
  queueMonitoring: "queue-monitoring",
  runMonitoring: "run-monitoring",
  streamControl: "stream-control",
});

export type WebSocketChannelPurpose =
  typeof WebSocketChannelPurposes[keyof typeof WebSocketChannelPurposes];

export const WebSocketChannelCapabilities = Object.freeze({
  statusRead: "status:read",
  queueRead: "queue:read",
  runRead: "run:read",
  runLogsRead: "run-logs:read",
  streamRead: "stream:read",
  streamControl: "stream:control",
});

export type WebSocketChannelCapability =
  typeof WebSocketChannelCapabilities[keyof typeof WebSocketChannelCapabilities];

const DefaultPurposeCapabilities: Readonly<Record<WebSocketChannelPurpose, ReadonlyArray<WebSocketChannelCapability>>> = Object.freeze({
  [WebSocketChannelPurposes.status]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
  ]),
  [WebSocketChannelPurposes.queueMonitoring]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
    WebSocketChannelCapabilities.queueRead,
  ]),
  [WebSocketChannelPurposes.runMonitoring]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
    WebSocketChannelCapabilities.runRead,
    WebSocketChannelCapabilities.runLogsRead,
  ]),
  [WebSocketChannelPurposes.streamControl]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
    WebSocketChannelCapabilities.streamRead,
    WebSocketChannelCapabilities.streamControl,
  ]),
});

export interface WebSocketAuthenticatedActorContext {
  readonly userIdentityId: string;
  readonly username: string;
  readonly sessionId: string;
  readonly accessChannel: "desktop" | "thin-client";
  readonly trustedDeviceId?: string;
  readonly sessionAssuranceLevel: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
}

export interface WebSocketChannelContext {
  readonly channelId: string;
  readonly connectionId: string;
  readonly establishedAt: string;
  readonly purpose: WebSocketChannelPurpose;
  readonly capabilities: ReadonlyArray<WebSocketChannelCapability>;
  readonly actor: WebSocketAuthenticatedActorContext;
  readonly workspaceScope: {
    readonly workspaceId?: string;
  };
  readonly transport: {
    readonly trustValidationEnforced: boolean;
    readonly scenario: string;
    readonly actorType: string;
    readonly remotePeerType: string;
  };
}

export interface BuildWebSocketChannelContextInput {
  readonly connectionId: string;
  readonly purpose: WebSocketChannelPurpose;
  readonly userIdentityId: string;
  readonly username: string;
  readonly sessionId: string;
  readonly accessChannel: "desktop" | "thin-client";
  readonly trustedDeviceId?: string;
  readonly sessionAssuranceLevel: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
  readonly workspaceId?: string;
  readonly transport: {
    readonly trustValidationEnforced: boolean;
    readonly scenario: string;
    readonly actorType: string;
    readonly remotePeerType: string;
  };
}

export function buildWebSocketChannelContext(input: BuildWebSocketChannelContextInput): WebSocketChannelContext {
  return Object.freeze({
    channelId: `ws-channel:${randomUUID()}`,
    connectionId: input.connectionId,
    establishedAt: new Date().toISOString(),
    purpose: input.purpose,
    capabilities: resolveWebSocketChannelCapabilities(input.purpose),
    actor: Object.freeze({
      userIdentityId: input.userIdentityId,
      username: input.username,
      sessionId: input.sessionId,
      accessChannel: input.accessChannel,
      trustedDeviceId: normalizeOptional(input.trustedDeviceId),
      sessionAssuranceLevel: input.sessionAssuranceLevel,
    }),
    workspaceScope: Object.freeze({
      workspaceId: normalizeOptional(input.workspaceId),
    }),
    transport: Object.freeze({
      trustValidationEnforced: input.transport.trustValidationEnforced,
      scenario: input.transport.scenario,
      actorType: input.transport.actorType,
      remotePeerType: input.transport.remotePeerType,
    }),
  });
}

export function parseWebSocketChannelPurpose(value: string | null | undefined): WebSocketChannelPurpose | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const values = Object.values(WebSocketChannelPurposes) as ReadonlyArray<string>;
  if (!values.includes(normalized)) {
    return undefined;
  }

  return normalized as WebSocketChannelPurpose;
}

export function resolveWebSocketChannelCapabilities(
  purpose: WebSocketChannelPurpose,
): ReadonlyArray<WebSocketChannelCapability> {
  return DefaultPurposeCapabilities[purpose] ?? Object.freeze([]);
}

export interface WebSocketChannelRegistry {
  register(context: WebSocketChannelContext): void;
  release(channelId: string): void;
  get(channelId: string): WebSocketChannelContext | undefined;
  list(): ReadonlyArray<WebSocketChannelContext>;
}

export class InMemoryWebSocketChannelRegistry implements WebSocketChannelRegistry {
  private readonly channels = new Map<string, WebSocketChannelContext>();

  public register(context: WebSocketChannelContext): void {
    this.channels.set(context.channelId, context);
  }

  public release(channelId: string): void {
    this.channels.delete(channelId);
  }

  public get(channelId: string): WebSocketChannelContext | undefined {
    return this.channels.get(channelId);
  }

  public list(): ReadonlyArray<WebSocketChannelContext> {
    return Object.freeze(Array.from(this.channels.values()));
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
