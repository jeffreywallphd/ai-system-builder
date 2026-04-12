import { describe, expect, it } from "bun:test";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { installIdentityHttpUpgradeBoundary } from "../composition/IdentityHttpUpgradeBoundary";

function waitForBoundaryDispatch(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("IdentityHttpUpgradeBoundary", () => {
  it("does not register an upgrade listener when websocket dispatch is not configured", () => {
    const server = createServer(() => {});

    const boundary = installIdentityHttpUpgradeBoundary({
      server,
    });

    expect(boundary.enabled).toBeFalse();
    expect(server.listenerCount("upgrade")).toBe(0);

    boundary.dispose();
    expect(server.listenerCount("upgrade")).toBe(0);
  });

  it("registers an isolated upgrade dispatch boundary independent from request handlers", async () => {
    const server = createServer(() => {});
    const request = Object.freeze({ url: "/ws/runtime" }) as unknown as IncomingMessage;
    const socket = Object.freeze({
      destroy() {
        // no-op for this test
      },
    }) as unknown as Socket;
    let receivedRequest: IncomingMessage | undefined;
    let receivedSocket: Socket | undefined;

    const boundary = installIdentityHttpUpgradeBoundary({
      server,
      dispatchUpgrade: async ({ request: incomingRequest, socket: incomingSocket }) => {
        receivedRequest = incomingRequest;
        receivedSocket = incomingSocket;
      },
    });

    expect(boundary.enabled).toBeTrue();
    expect(server.listenerCount("upgrade")).toBe(1);

    server.emit("upgrade", request, socket);
    await waitForBoundaryDispatch();

    expect(receivedRequest).toBe(request);
    expect(receivedSocket).toBe(socket);

    boundary.dispose();
    expect(server.listenerCount("upgrade")).toBe(0);
  });

  it("reports unhandled upgrade errors and destroys rejected sockets", async () => {
    const server = createServer(() => {});
    const request = Object.freeze({ method: "GET", url: "/ws/runtime" }) as unknown as IncomingMessage;
    let socketDestroyed = false;
    const socket = Object.freeze({
      destroy() {
        socketDestroyed = true;
      },
    }) as unknown as Socket;
    const failure = new Error("upgrade failure");
    let capturedError: unknown;

    installIdentityHttpUpgradeBoundary({
      server,
      dispatchUpgrade: async () => {
        throw failure;
      },
      onUnhandledUpgradeError: ({ error }) => {
        capturedError = error;
      },
    });

    server.emit("upgrade", request, socket);
    await waitForBoundaryDispatch();

    expect(capturedError).toBe(failure);
    expect(socketDestroyed).toBeTrue();
  });
});
