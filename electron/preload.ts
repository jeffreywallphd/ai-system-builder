import { contextBridge, ipcRenderer } from "electron";

const bootstrap = ipcRenderer.sendSync("ai-loom-desktop:get-bootstrap-sync");

contextBridge.exposeInMainWorld("aiLoomDesktop", {
  bootstrap,
  storage: {
    getItem(key: string) {
      return ipcRenderer.sendSync("ai-loom-desktop-storage:getItem", key) as string | null;
    },
    setItem(key: string, value: string) {
      ipcRenderer.sendSync("ai-loom-desktop-storage:setItem", key, value);
    },
    removeItem(key: string) {
      ipcRenderer.sendSync("ai-loom-desktop-storage:removeItem", key);
    },
  },
});
