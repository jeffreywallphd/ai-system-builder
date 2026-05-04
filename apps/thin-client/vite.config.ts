import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createThinClientApiProxyConfig } from "./viteDevProxyConfig";
import { resolveThinClientViteHttpsConfig } from "./viteDevHttpsConfig";

const thinClientViteHttpsConfig = resolveThinClientViteHttpsConfig();

export default defineConfig({
  plugins: [react()],
  server: {
    https: thinClientViteHttpsConfig || undefined,
    host: "0.0.0.0",
    proxy: {
      "/api": createThinClientApiProxyConfig(),
    },
  },
});
