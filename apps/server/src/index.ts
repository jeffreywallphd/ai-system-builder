import { createServer } from "./createServer";
import http from "node:http";
import https from "node:https";
import { createHttpsServerOptions } from "../../../modules/adapters/transport/api-express/security";

const { app, config, loggingPort } = createServer();

const listener = config.security.httpsEnabled
  ? https.createServer(createHttpsServerOptions(config.security.tlsCertPath!, config.security.tlsKeyPath!), app)
  : http.createServer(app);

listener.listen(config.port, () => {
  void loggingPort.log({
    timestamp: new Date().toISOString(), level: "info", verbosity: "normal", event: "server.listener.started", host: "server", component: "server-host",
    message: config.security.mode === "disabled-dev" ? "Server started with security disabled-dev (INSECURE)." : "Server listener started.",
    data: { port: config.port, storageRootDirectory: config.storageRootDirectory, runtimeRootDirectory: config.runtimeRootDirectory, securityMode: config.security.mode, httpsEnabled: config.security.httpsEnabled, httpsRequired: config.security.httpsRequired },
  });
});
