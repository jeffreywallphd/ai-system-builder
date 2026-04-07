import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo, Socket } from "node:net";
import { connect } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { AuthoritativeRuntimeEventStream } from "../../../../api/system-runtime/AuthoritativeRuntimeEventStream";
import type { SystemRuntimeBackendApi } from "../../../../api/system-runtime/SystemRuntimeBackendApi";
import { RuntimeRealtimeTopics } from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import {
  parseRuntimeRealtimeWebSocketErrorMessage,
  parseRuntimeRealtimeWebSocketEventMessage,
  parseRuntimeRealtimeWebSocketSubscriptionAckMessage,
} from "@shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts";
import { createIdentityHttpServer } from "../IdentityHttpServer";

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

class RuntimeRealtimeBackendStub {
  private readonly stream = new AuthoritativeRuntimeEventStream();

  public subscribeToRealtimeEvents(input: {
    readonly request: Parameters<AuthoritativeRuntimeEventStream["subscribe"]>[0]["request"];
    readonly listener: Parameters<AuthoritativeRuntimeEventStream["subscribe"]>[0]["listener"];
  }) {
    try {
      return {
        ok: true as const,
        data: this.stream.subscribe({
          request: input.request,
          listener: input.listener,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Realtime subscription failed.";
      const code = message.startsWith("forbidden:") ? "forbidden" : "invalid-request";
      return {
        ok: false as const,
        error: {
          code,
          message,
        },
      };
    }
  }

  public publishRunStatus(input: { readonly workspaceId: string; readonly executionId: string; readonly status: string }): void {
    this.stream.publishRunStatusEvent({
      workspaceId: input.workspaceId,
      payload: {
        executionId: input.executionId,
        status: input.status,
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    });
  }
}

class WebSocketFrameReader {
  private readonly queue: Array<{ readonly opcode: number; readonly payload: Buffer }> = [];
  private readonly waiters: Array<(value: { readonly opcode: number; readonly payload: Buffer }) => void> = [];
  private buffer = Buffer.alloc(0);

  public constructor(socket: Socket) {
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
  }

  public async nextFrame(timeoutMs = 2_000): Promise<{ readonly opcode: number; readonly payload: Buffer }> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for websocket frame after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.waiters.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  }

  private drain(): void {
    let offset = 0;
    while (offset < this.buffer.length) {
      const parsed = tryParseWebSocketFrame(this.buffer, offset);
      if (!parsed) {
        break;
      }
      offset = parsed.nextOffset;
      this.pushFrame(parsed);
    }
    this.buffer = offset >= this.buffer.length ? Buffer.alloc(0) : this.buffer.subarray(offset);
  }

  private pushFrame(frame: { readonly opcode: number; readonly payload: Buffer }): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(frame);
      return;
    }
    this.queue.push(frame);
  }
}

async function startServer(runtimeBackend: RuntimeRealtimeBackendStub): Promise<{ readonly baseUrl: string; readonly port: number }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    systemRuntimeBackendApi: runtimeBackend as unknown as SystemRuntimeBackendApi,
    webSocket: {
      channelPathPrefix: "/ws",
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

async function registerAndLogin(baseUrl: string, username: string): Promise<string> {
  const register = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: { candidate: "StrongPass!2026" },
    }),
  });
  expect(register.status).toBe(200);
  const login = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      accessChannel: "desktop",
      credential: { candidate: "StrongPass!2026" },
    }),
  });
  expect(login.status).toBe(200);
  const body = await login.json() as { readonly data: { readonly sessionToken: string } };
  return body.data.sessionToken;
}

async function openWebSocketUpgradeSocket(input: {
  readonly port: number;
  readonly path: string;
  readonly authorization: string;
}): Promise<{ readonly socket: Socket; readonly response: string }> {
  return await new Promise<{ readonly socket: Socket; readonly response: string }>((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port: input.port });
    const chunks: Buffer[] = [];
    let settled = false;

    socket.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    socket.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
      const response = Buffer.concat(chunks).toString("utf8");
      if (!settled && response.includes("\r\n\r\n")) {
        settled = true;
        resolve(Object.freeze({ socket, response }));
      }
    });

    socket.once("connect", () => {
      const requestLines = [
        `GET ${input.path} HTTP/1.1`,
        "Host: 127.0.0.1",
        "Connection: Upgrade",
        "Upgrade: websocket",
        "Sec-WebSocket-Version: 13",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        `Authorization: Bearer ${input.authorization}`,
        "",
        "",
      ];
      socket.write(requestLines.join("\r\n"));
    });
  });
}

function buildMaskedClientTextFrame(payload: string): Buffer {
  const payloadBytes = Buffer.from(payload, "utf8");
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const maskedPayload = Buffer.alloc(payloadBytes.length);
  for (let index = 0; index < payloadBytes.length; index += 1) {
    maskedPayload[index] = payloadBytes[index] ^ mask[index % 4];
  }

  if (payloadBytes.length <= 125) {
    const frame = Buffer.alloc(2 + 4 + maskedPayload.length);
    frame[0] = 0x81;
    frame[1] = 0x80 | payloadBytes.length;
    mask.copy(frame, 2);
    maskedPayload.copy(frame, 6);
    return frame;
  }

  const frame = Buffer.alloc(4 + 4 + maskedPayload.length);
  frame[0] = 0x81;
  frame[1] = 0x80 | 126;
  frame.writeUInt16BE(payloadBytes.length, 2);
  mask.copy(frame, 4);
  maskedPayload.copy(frame, 8);
  return frame;
}

function tryParseWebSocketFrame(
  buffer: Buffer,
  offset: number,
): { readonly opcode: number; readonly payload: Buffer; readonly nextOffset: number } | undefined {
  if (buffer.length - offset < 2) {
    return undefined;
  }
  const second = buffer[offset + 1];
  let payloadLength = second & 0x7f;
  let cursor = offset + 2;
  if (payloadLength === 126) {
    if (buffer.length - cursor < 2) {
      return undefined;
    }
    payloadLength = buffer.readUInt16BE(cursor);
    cursor += 2;
  } else if (payloadLength === 127) {
    if (buffer.length - cursor < 8) {
      return undefined;
    }
    const bigLength = buffer.readBigUInt64BE(cursor);
    cursor += 8;
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Websocket frame payload is too large.");
    }
    payloadLength = Number(bigLength);
  }
  if (buffer.length - cursor < payloadLength) {
    return undefined;
  }
  const payload = Buffer.from(buffer.subarray(cursor, cursor + payloadLength));
  cursor += payloadLength;
  return Object.freeze({
    opcode: buffer[offset] & 0x0f,
    payload,
    nextOffset: cursor,
  });
}

describe("IdentityHttpServer runtime realtime websocket delivery", () => {
  it("accepts runtime subscriptions and delivers canonical event envelopes", async () => {
    const runtimeBackend = new RuntimeRealtimeBackendStub();
    const { baseUrl, port } = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.ws.delivery.1");

    const { socket, response } = await openWebSocketUpgradeSocket({
      port,
      path: "/ws?purpose=run-monitoring&workspaceId=workspace-a",
      authorization: token,
    });
    expect(response.startsWith("HTTP/1.1 101")).toBeTrue();
    const reader = new WebSocketFrameReader(socket);

    socket.write(buildMaskedClientTextFrame(JSON.stringify({
      action: "runtime-realtime.subscribe",
      request: {
        topics: [{ topic: RuntimeRealtimeTopics.runStatus, workspaceId: "workspace-a", executionId: "exec-1" }],
        mode: "live-only",
      },
    })));

    const ackFrame = await reader.nextFrame();
    expect(ackFrame.opcode).toBe(1);
    const ack = parseRuntimeRealtimeWebSocketSubscriptionAckMessage(JSON.parse(ackFrame.payload.toString("utf8")));
    expect(ack.type).toBe("runtime-realtime.subscription-ack");
    expect(ack.topics[0]?.topic).toBe(RuntimeRealtimeTopics.runStatus);

    runtimeBackend.publishRunStatus({
      workspaceId: "workspace-a",
      executionId: "exec-1",
      status: "running",
    });

    const eventFrame = await reader.nextFrame();
    expect(eventFrame.opcode).toBe(1);
    const event = parseRuntimeRealtimeWebSocketEventMessage(JSON.parse(eventFrame.payload.toString("utf8")));
    expect(event.type).toBe("runtime-realtime.event");
    expect(event.event.topic).toBe(RuntimeRealtimeTopics.runStatus);
    expect(event.event.runScope.executionId).toBe("exec-1");
    socket.destroy();
  });

  it("rejects workspace/topic mismatch with forbidden realtime error", async () => {
    const runtimeBackend = new RuntimeRealtimeBackendStub();
    const { baseUrl, port } = await startServer(runtimeBackend);
    const token = await registerAndLogin(baseUrl, "runtime.ws.scope.1");

    const { socket, response } = await openWebSocketUpgradeSocket({
      port,
      path: "/ws?purpose=run-monitoring&workspaceId=workspace-a",
      authorization: token,
    });
    expect(response.startsWith("HTTP/1.1 101")).toBeTrue();
    const reader = new WebSocketFrameReader(socket);

    socket.write(buildMaskedClientTextFrame(JSON.stringify({
      action: "runtime-realtime.subscribe",
      request: {
        topics: [{ topic: RuntimeRealtimeTopics.runStatus, workspaceId: "workspace-b" }],
      },
    })));

    const errorFrame = await reader.nextFrame();
    expect(errorFrame.opcode).toBe(1);
    const error = parseRuntimeRealtimeWebSocketErrorMessage(JSON.parse(errorFrame.payload.toString("utf8")));
    expect(error.error.code).toBe("forbidden");
    const closeFrame = await reader.nextFrame();
    expect(closeFrame.opcode).toBe(8);
    socket.destroy();
  });
});
