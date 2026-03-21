declare module "electron" {
  export const app: any;
  export const BrowserWindow: any;
  export const ipcMain: any;
  export const ipcRenderer: any;
  export const contextBridge: any;
}

declare module "electron-squirrel-startup" {
  const started: boolean;
  export default started;
}

declare module "better-sqlite3" {
  class Statement {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  type Transaction = (...params: unknown[]) => unknown;

  class Database {
    constructor(path: string);
    prepare(sql: string): Statement;
    pragma(value: string): void;
    exec(sql: string): void;
    transaction(fn: () => void): Transaction;
    close(): void;
  }

  export = Database;
}

declare module "@electron-forge/maker-dmg" {
  export class MakerDMG {
    constructor(config?: unknown, platforms?: string[]);
  }
}

declare module "@electron-forge/maker-squirrel" {
  export class MakerSquirrel {
    constructor(config?: unknown, platforms?: string[]);
  }
}

declare module "@electron-forge/maker-zip" {
  export class MakerZIP {
    constructor(config?: unknown, platforms?: string[]);
  }
}

declare module "@electron-forge/plugin-vite" {
  export class VitePlugin {
    constructor(config?: unknown);
  }
}

declare module "@electron-forge/shared-types" {
  export interface ForgeConfig {
    [key: string]: unknown;
  }
}
