import http from "node:http";
import https from "node:https";
import { createHttpsServerOptions } from "../../../modules/adapters/transport/api-express/security";
import { createServer } from "./createServer";

const { app, config, loggingPort } = createServer();

let listener: http.Server | https.Server;
if (config.security.httpsEnabled) {
  listener = https.createServer(createHttpsServerOptions(config.security.tlsCertPath, config.security.tlsKeyPath), app);
} else {
  listener = http.createServer(app);
}

listener.listen(config.port, () => {
  void loggingPort.log({
    timestamp: new Date().toISOString(),
    level: config.security.mode === "disabled-dev" ? "warn" : "info",
    verbosity: "normal",
    event: config.security.mode === "disabled-dev" ? "server.security.insecure-http" : "server.http.listening",
    host: "server",
    component: "server-host",
    message: config.security.mode === "disabled-dev"
      ? "SECURITY MODE: disabled-dev (INSECURE). HTTP/no-auth local development mode is enabled."
      : "Server listening with LAN HTTPS token security.",
    data: {
      mode: config.security.mode,
      port: config.port,
      httpsEnabled: config.security.httpsEnabled,
      httpsRequired: config.security.httpsRequired,
      authRequired: config.security.authRequired,
      pairingEnabled: config.security.pairingEnabled,
      storageRootDirectory: config.storageRootDirectory,
      runtimeRootDirectory: config.runtimeRootDirectory,
      securityStorePath: config.security.securityStorePath,
    },
  });
});
