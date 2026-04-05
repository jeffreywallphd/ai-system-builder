import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogEvent,
  type IdentityHttpServerLogger,
} from "../IdentityHttpServer";
import { TransportSecurityScenarios } from "../../../../../src/domain/security/TransportSecurityDomain";
import type { ValidateTransportConnectionTrustRequest } from "../../../../../src/application/security/ports/TransportTrustValidationPorts";
import type {
  HttpTransportTrustValidationResult,
  WebSocketTransportTrustValidationResult,
} from "../../../../../src/infrastructure/transport/TransportTrustValidationAdapters";
import type { WebSocketChannelContext } from "../../../../../src/infrastructure/transport/websocket/SecureWebSocketChannelContext";

class NoopLogger implements IdentityHttpServerLogger {
  public info(_event: IdentityHttpServerLogEvent): void {}
  public warn(_event: IdentityHttpServerLogEvent): void {}
  public error(_event: IdentityHttpServerLogEvent): void {}
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
});

async function startServer(input: {
  readonly secureTransport?: {
    readonly requireHttps: boolean;
    readonly requireWss?: boolean;
    readonly allowInsecureLoopback: boolean;
  };
  readonly allowInsecureLoopback: boolean;
  readonly logger?: IdentityHttpServerLogger;
  readonly validateHttp: (request: ValidateTransportConnectionTrustRequest) => Promise<HttpTransportTrustValidationResult>;
  readonly validateWebSocket: (request: ValidateTransportConnectionTrustRequest) => Promise<WebSocketTransportTrustValidationResult>;
  readonly onChannelEstablished?: (channel: WebSocketChannelContext) => Promise<void> | void;
}): Promise<{ readonly baseUrl: string; readonly port: number }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger: input.logger ?? new NoopLogger(),
    secureTransport: input.secureTransport,
    transportTrust: {
      httpValidator: {
        validate: input.validateHttp,
      },
      websocketValidator: {
        validate: input.validateWebSocket,
      },
      allowInsecureLoopback: input.allowInsecureLoopback,
      defaultScenario: TransportSecurityScenarios.thinClientToControlPlane,
    },
    webSocket: {
      channelPathPrefix: "/ws",
      onChannelEstablished: async (channel, socket) => {
        await input.onChannelEstablished?.(channel);
        socket.end();
      },
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  servers.push(server);
  const address = server.address() as AddressInfo;
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    port: address.port,
  });
}

async function registerAndLogin(baseUrl: string): Promise<string> {
  const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "ws.transport.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(register.status).toBe(200);

  const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      providerSubject: "ws.transport.user",
      accessChannel: "desktop",
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(login.status).toBe(200);
  const loginBody = await login.json() as { readonly data: { readonly sessionToken: string } };
  return loginBody.data.sessionToken;
}

async function sendWebSocketUpgradeRequest(input: {
  readonly port: number;
  readonly path: string;
  readonly authorization?: string;
  readonly headers?: Readonly<Record<string, string>>;
}): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port: input.port });
    const chunks: Buffer[] = [];
    let settled = false;

    socket.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
    socket.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    socket.on("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.on("close", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    socket.once("connect", () => {
      const dynamicHeaders = Object.entries(input.headers ?? {}).map(([key, value]) => `${key}: ${value}`);
      const requestLines = [
        `GET ${input.path} HTTP/1.1`,
        "Host: 127.0.0.1",
        "Connection: Upgrade",
        "Upgrade: websocket",
        "Sec-WebSocket-Version: 13",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        ...(input.authorization ? [`Authorization: Bearer ${input.authorization}`] : []),
        ...dynamicHeaders,
        "",
        "",
      ];
      socket.write(requestLines.join("\r\n"));
    });
  });
}

function parseUpgradeResponse(response: string): {
  readonly statusCode: number;
  readonly body?: {
    readonly ok: boolean;
    readonly error?: {
      readonly code?: string;
      readonly closeCode?: number;
    };
  };
} {
  const statusMatch = response.match(/^HTTP\/1\.1\s+(\d{3})/m);
  const statusCode = Number.parseInt(statusMatch?.[1] ?? "0", 10);
  const separator = "\r\n\r\n";
  const separatorIndex = response.indexOf(separator);
  if (separatorIndex < 0) {
    return Object.freeze({ statusCode });
  }

  const bodyText = response.slice(separatorIndex + separator.length).trim();
  if (!bodyText) {
    return Object.freeze({ statusCode });
  }

  return Object.freeze({
    statusCode,
    body: JSON.parse(bodyText) as {
      readonly ok: boolean;
      readonly error?: {
        readonly code?: string;
        readonly closeCode?: number;
      };
    },
  });
}

describe("IdentityHttpServer websocket transport trust", () => {
  it("rejects websocket upgrades when secure websocket transport is required", async () => {
    const { port } = await startServer({
      allowInsecureLoopback: false,
      secureTransport: {
        requireHttps: true,
        requireWss: true,
        allowInsecureLoopback: false,
      },
      validateHttp: async () => ({
        ok: true,
        decision: {} as never,
      }),
      validateWebSocket: async () => ({
        ok: true,
        decision: {} as never,
      }),
    });

    const response = await sendWebSocketUpgradeRequest({
      port,
      path: "/ws?purpose=status",
    });
    const parsed = parseUpgradeResponse(response);
    expect(parsed.statusCode).toBe(403);
    expect(parsed.body?.error?.code).toBe("secure-transport-required");
  });

  it("rejects websocket upgrades without an authenticated session token", async () => {
    const { port } = await startServer({
      allowInsecureLoopback: false,
      validateHttp: async () => ({
        ok: true,
        decision: {} as never,
      }),
      validateWebSocket: async () => ({
        ok: true,
        decision: {} as never,
      }),
    });

    const response = await sendWebSocketUpgradeRequest({
      port,
      path: "/ws?purpose=queue-monitoring",
    });
    const parsed = parseUpgradeResponse(response);
    expect(parsed.statusCode).toBe(401);
    expect(parsed.body?.error?.code).toBe("authentication-failed");
    expect(parsed.body?.error?.closeCode).toBe(4401);
  });

  it("rejects websocket upgrades when transport trust validation denies the channel", async () => {
    const { baseUrl, port } = await startServer({
      allowInsecureLoopback: false,
      validateHttp: async () => ({
        ok: true,
        decision: {} as never,
      }),
      validateWebSocket: async () => ({
        ok: false,
        closeCode: 4403,
        reason: "Transport trust validation rejected this connection.",
        error: {
          code: "forbidden",
          message: "Transport trust validation rejected this connection.",
        },
      }),
    });
    const token = await registerAndLogin(baseUrl);

    const response = await sendWebSocketUpgradeRequest({
      port,
      path: "/ws?purpose=run-monitoring",
      authorization: token,
    });
    const parsed = parseUpgradeResponse(response);
    expect(parsed.statusCode).toBe(403);
    expect(parsed.body?.error?.code).toBe("transport-trust-rejected");
    expect(parsed.body?.error?.closeCode).toBe(4403);
  });

  it("rejects websocket upgrades for unsupported channel purpose", async () => {
    const { baseUrl, port } = await startServer({
      allowInsecureLoopback: false,
      validateHttp: async () => ({
        ok: true,
        decision: {} as never,
      }),
      validateWebSocket: async () => ({
        ok: true,
        decision: {} as never,
      }),
    });
    const token = await registerAndLogin(baseUrl);

    const response = await sendWebSocketUpgradeRequest({
      port,
      path: "/ws?purpose=unknown-purpose",
      authorization: token,
    });
    const parsed = parseUpgradeResponse(response);
    expect(parsed.statusCode).toBe(403);
    expect(parsed.body?.error?.code).toBe("unsupported-channel-purpose");
    expect(parsed.body?.error?.closeCode).toBe(4403);
  });

  it("establishes session-bound websocket channel context on accepted upgrades", async () => {
    let capturedChannel: WebSocketChannelContext | undefined;
    const { baseUrl, port } = await startServer({
      allowInsecureLoopback: false,
      validateHttp: async () => ({
        ok: true,
        decision: {} as never,
      }),
      validateWebSocket: async () => ({
        ok: true,
        decision: {} as never,
      }),
      onChannelEstablished: (channel) => {
        capturedChannel = channel;
      },
    });
    const token = await registerAndLogin(baseUrl);

    const response = await sendWebSocketUpgradeRequest({
      port,
      path: "/ws?purpose=queue-monitoring&workspaceId=workspace-alpha",
      authorization: token,
    });
    const parsed = parseUpgradeResponse(response);

    expect(parsed.statusCode).toBe(101);
    expect(capturedChannel).toBeDefined();
    expect(capturedChannel?.purpose).toBe("queue-monitoring");
    expect(capturedChannel?.workspaceScope.workspaceId).toBe("workspace-alpha");
    expect(capturedChannel?.actor.accessChannel).toBe("desktop");
    expect(capturedChannel?.capabilities).toContain("queue:read");
    expect(capturedChannel?.transport.trustValidationEnforced).toBe(true);
  });
});
