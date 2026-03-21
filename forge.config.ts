import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "ai-loom-studio",
    extraResource: [
      "python-runtime",
      "runtime-assets",
      "infrastructure/runtime/service-supervisor.js",
      "README.md",
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "ai_loom_studio",
      setupExe: "AI-Loom-Studio-Setup.exe",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({}, ["darwin"]),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "electron/main/main.ts",
          config: "vite.main.config.ts",
        },
        {
          entry: "electron/preload.ts",
          config: "vite.preload.config.ts",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
