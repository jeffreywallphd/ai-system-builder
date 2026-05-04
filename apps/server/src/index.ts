import { accessSync, constants } from "node:fs";
import http from "node:http";
import https from "node:https";
import { createHttpsServerOptions } from "../../../modules/adapters/transport/api-express/security";
import { createServer } from "./createServer";

const { app, config, loggingPort } = createServer();

if (config.security.httpsEnabled) {
  if (!config.security.tlsCertPath || !config.security.tlsKeyPath) throw new Error("HTTPS enabled but TLS cert/key paths are missing. Set SECURITY_TLS_CERT_PATH and SECURITY_TLS_KEY_PATH.");
  accessSync(config.security.tlsCertPath, constants.R_OK);
  accessSync(config.security.tlsKeyPath, constants.R_OK);
}

let listener: http.Server | https.Server;
if (config.security.httpsEnabled) {
  const certPath = config.security.tlsCertPath as string;
  const keyPath = config.security.tlsKeyPath as string;
  listener = https.createServer(createHttpsServerOptions(certPath, keyPath), app);
} else {
  listener = http.createServer(app);
}

if (!config.security.httpsEnabled) {
  void loggingPort.log({ timestamp: new Date().toISOString(), level: "warn", verbosity: "normal", event: "server.security.insecure-http", host: "server", component: "server-host", message: "Server started over HTTP without TLS (INSECURE).", data: { port: config.port } });
}

listener.listen(config.port);
