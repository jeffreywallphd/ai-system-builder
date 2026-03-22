import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const SUPERVISOR_PORT = Number(process.env.SERVICE_SUPERVISOR_PORT || 8790);
const SUPERVISOR_AUTOSTART_ENABLED = process.env.AI_LOOM_SERVICE_SUPERVISOR_AUTOSTART !== "false";
const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SUPERVISOR_ENTRYPOINT = path.resolve(REPOSITORY_ROOT, "infrastructure/runtime/service-supervisor.js");

function canConnectToPort(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

function managedServiceSupervisorPlugin(): Plugin {
  let supervisorProcess: ChildProcess | undefined;
  let cleanupRegistered = false;

  const stopSupervisor = () => {
    if (!supervisorProcess || supervisorProcess.killed) {
      return;
    }

    supervisorProcess.kill("SIGTERM");
    supervisorProcess = undefined;
  };

  return {
    name: "ai-loom-managed-service-supervisor",
    apply: "serve",
    async configureServer(server) {
      if (!SUPERVISOR_AUTOSTART_ENABLED || supervisorProcess) {
        return;
      }

      if (await canConnectToPort(SUPERVISOR_PORT)) {
        server.config.logger.info(
          `[ai-loom] managed service supervisor already available on http://127.0.0.1:${SUPERVISOR_PORT}; skipping auto-start.`,
        );
        return;
      }

      supervisorProcess = spawn(process.execPath, [SUPERVISOR_ENTRYPOINT], {
        cwd: REPOSITORY_ROOT,
        env: process.env,
        stdio: "inherit",
      });

      supervisorProcess.once("exit", () => {
        supervisorProcess = undefined;
      });

      server.config.logger.info(
        `[ai-loom] auto-started managed service supervisor on http://127.0.0.1:${SUPERVISOR_PORT}.`,
      );

      if (!cleanupRegistered) {
        cleanupRegistered = true;
        server.httpServer?.once("close", stopSupervisor);
        process.once("exit", stopSupervisor);
        process.once("SIGINT", stopSupervisor);
        process.once("SIGTERM", stopSupervisor);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), managedServiceSupervisorPlugin()],
  resolve: {
    alias: mode === "browser"
      ? [
          {
            find: "./modelManagementDependencies",
            replacement: path.resolve(
              REPOSITORY_ROOT,
              "ui/composition/modelManagementDependencies.browser.ts",
            ),
          },
        ]
      : [],
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
  },
}));
