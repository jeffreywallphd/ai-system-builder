import type { RequestListener, Server } from "node:http";
import type { Server as HttpsServer } from "node:https";

export type IdentityHttpTransportServer = Server | HttpsServer;

export type IdentityHttpTransportServerFactory = (
  requestListener: RequestListener,
) => IdentityHttpTransportServer;

export interface IdentityHttpTransportAdapter {
  readonly adapterId: string;
  readonly createServer: IdentityHttpTransportServerFactory;
}

export function createIdentityHttpTransportAdapter(input: {
  readonly adapterId?: string;
  readonly createServer: IdentityHttpTransportServerFactory;
}): IdentityHttpTransportAdapter {
  return Object.freeze({
    adapterId: input.adapterId ?? "identity-http:node-server-adapter",
    createServer: input.createServer,
  });
}
