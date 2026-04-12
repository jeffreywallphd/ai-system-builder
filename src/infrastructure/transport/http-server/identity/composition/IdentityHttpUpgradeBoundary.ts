import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Server as HttpsServer } from "node:https";
import type { Socket } from "node:net";

export type IdentityHttpUpgradeBoundaryServer = HttpServer | HttpsServer;

export interface IdentityHttpUpgradeDispatchContext {
  readonly request: IncomingMessage;
  readonly socket: Socket;
}

export interface IdentityHttpUpgradeErrorContext extends IdentityHttpUpgradeDispatchContext {
  readonly error: unknown;
}

export interface IdentityHttpUpgradeBoundary {
  readonly enabled: boolean;
  dispose(): void;
}

export type IdentityHttpUpgradeDispatcher = (
  context: IdentityHttpUpgradeDispatchContext,
) => Promise<void>;

export function installIdentityHttpUpgradeBoundary(input: {
  readonly server: IdentityHttpUpgradeBoundaryServer;
  readonly dispatchUpgrade?: IdentityHttpUpgradeDispatcher;
  onUnhandledUpgradeError?(context: IdentityHttpUpgradeErrorContext): void;
}): IdentityHttpUpgradeBoundary {
  const dispatchUpgrade = input.dispatchUpgrade;
  if (!dispatchUpgrade) {
    return Object.freeze({
      enabled: false,
      dispose(): void {
        // No upgrade listener was registered for this boundary.
      },
    });
  }

  const upgradeListener = (request: IncomingMessage, socket: Socket): void => {
    void dispatchUpgrade(Object.freeze({ request, socket })).catch((error) => {
      input.onUnhandledUpgradeError?.(Object.freeze({ request, socket, error }));
      socket.destroy();
    });
  };

  input.server.on("upgrade", upgradeListener);

  return Object.freeze({
    enabled: true,
    dispose(): void {
      input.server.off("upgrade", upgradeListener);
    },
  });
}
