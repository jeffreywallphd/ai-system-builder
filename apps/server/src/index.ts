import type { ServerListener } from "./createServer";
import { createServer, createServerListener } from "./createServer";

let activeListener: ServerListener | undefined;
let restartQueue = Promise.resolve();

async function startServer(): Promise<void> {
  const createdServer = await createServer({
    restartServer: () => {
      restartQueue = restartQueue.then(restartServer);
    },
  });
  const listener = createServerListener(createdServer);
  activeListener = listener;

  listener.listen(createdServer.config.port, () => {
    void createdServer.loggingPort.log({
      timestamp: new Date().toISOString(),
      level: createdServer.config.security.mode === "disabled-dev" ? "warn" : "info",
      verbosity: "normal",
      event: createdServer.config.security.mode === "disabled-dev" ? "server.security.insecure-http" : "server.http.listening",
      host: "server",
      component: "server-host",
      message: createdServer.config.security.mode === "disabled-dev"
        ? "SECURITY MODE: disabled-dev (INSECURE). HTTP/no-auth local development mode is enabled."
        : "Server listening with LAN HTTPS token security.",
      data: {
        mode: createdServer.config.security.mode,
        port: createdServer.config.port,
        httpsEnabled: createdServer.config.security.httpsEnabled,
        httpsRequired: createdServer.config.security.httpsRequired,
        authRequired: createdServer.config.security.authRequired,
        pairingEnabled: createdServer.config.security.pairingEnabled,
        securityStorePath: createdServer.config.security.securityStorePath,
        tlsMode: createdServer.config.security.tls.certMode,
        tlsSource: createdServer.config.security.tlsStatus?.source,
        tlsHosts: createdServer.config.security.tls.hosts,
      },
    });
  });
}

async function closeActiveListener(): Promise<void> {
  const listener = activeListener;
  activeListener = undefined;
  if (!listener) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    listener.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function restartServer(): Promise<void> {
  await closeActiveListener();
  await startServer();
}

void startServer();
