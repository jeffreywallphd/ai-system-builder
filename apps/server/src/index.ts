import { createServer, createServerListener } from "./createServer";

async function main() {
  const { app, config, loggingPort } = await createServer();

  const listener = createServerListener({ app, config, loggingPort });

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
      data: { mode: config.security.mode, port: config.port, httpsEnabled: config.security.httpsEnabled, httpsRequired: config.security.httpsRequired, authRequired: config.security.authRequired, pairingEnabled: config.security.pairingEnabled, securityStorePath: config.security.securityStorePath, tlsMode: config.security.tls.certMode, tlsSource: config.security.tlsStatus?.source, tlsHosts: config.security.tls.hosts },
    });
  });
}

void main();
