import type { DesktopBridge } from "../../electron/shared/DesktopContracts";

declare global {
  interface Window {
    aiLoomDesktop?: DesktopBridge;
  }
}

export {};
