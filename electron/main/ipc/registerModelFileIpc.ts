import fs from "node:fs";
import path from "node:path";
import { listEntries, toFileEntry } from "../ModelFileEntries";
import { resolveModelFileAbsolutePath } from "../ModelFilePathPolicy";
import type { ModelFileIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerModelFileIpc(params: ModelFileIpcRegistrationParams): void {
  const { ipcMain, storagePaths } = params;

  ipcMain.on("ai-loom-desktop-model-files:exists", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = fs.existsSync(absolutePath);
  });
  ipcMain.on("ai-loom-desktop-model-files:stat", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = toFileEntry(storagePaths.modelsDirectory, absolutePath);
  });
  ipcMain.on("ai-loom-desktop-model-files:read", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = new Uint8Array(fs.readFileSync(absolutePath));
  });
  ipcMain.on("ai-loom-desktop-model-files:write", (_event, request: { path: string; content: Uint8Array; overwrite?: boolean; createDirectories?: boolean }) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.path);
    if (!request.overwrite && fs.existsSync(absolutePath)) {
      throw new Error(`File '${request.path}' already exists.`);
    }
    if (request.createDirectories) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    }
    fs.writeFileSync(absolutePath, Buffer.from(request.content));
  });
  ipcMain.on("ai-loom-desktop-model-files:delete", (_event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    }
  });
  ipcMain.on("ai-loom-desktop-model-files:list", (event, targetPath: string, options?: { recursive?: boolean }) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = listEntries(storagePaths.modelsDirectory, absolutePath, options?.recursive === true);
  });
  ipcMain.on("ai-loom-desktop-model-files:move", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    const absoluteSourcePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.from);
    const absoluteTargetPath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.to);
    if (!request.overwrite && fs.existsSync(absoluteTargetPath)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
    fs.renameSync(absoluteSourcePath, absoluteTargetPath);
  });
  ipcMain.on("ai-loom-desktop-model-files:copy", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    const absoluteSourcePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.from);
    const absoluteTargetPath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.to);
    if (!request.overwrite && fs.existsSync(absoluteTargetPath)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
    fs.copyFileSync(absoluteSourcePath, absoluteTargetPath);
  });
}
