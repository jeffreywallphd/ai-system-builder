import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createThinClientApiProxyConfig } from "./viteDevProxyConfig";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": createThinClientApiProxyConfig(),
    },
  },
});
