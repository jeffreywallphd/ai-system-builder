import { createServer } from "./createServer";

const { app, config, loggingPort } = createServer();

app.listen(config.port, () => {
  void loggingPort.log({
    timestamp: new Date().toISOString(),
    level: "info",
    verbosity: "normal",
    event: "server.http.listening",
    host: "server",
    component: "server-host",
    message: "Server HTTP listener started.",
    data: {
      port: config.port,
      storageRootDirectory: config.storageRootDirectory,
      runtimeRootDirectory: config.runtimeRootDirectory,
    },
  });
});
