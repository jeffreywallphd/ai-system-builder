import { readFileSync } from "node:fs";
import type { ServerOptions } from "node:https";

export function createHttpsServerOptions(certPath: string, keyPath: string): ServerOptions {
  return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
}
