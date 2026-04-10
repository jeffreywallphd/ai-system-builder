interface StorageLike extends Storage {}

export function resolveDesktopStorageAdapter(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storage = window.aiLoomDesktop?.auth?.storage ?? window.aiLoomDesktop?.storage;
  if (!storage) {
    return undefined;
  }

  return {
    get length() {
      return 0;
    },
    clear() {
      // no-op: production desktop persistence only exposes targeted key mutation.
    },
    key() {
      return null;
    },
    getItem(key: string) {
      return storage.getItem(key);
    },
    setItem(key: string, value: string) {
      storage.setItem(key, value);
    },
    removeItem(key: string) {
      storage.removeItem(key);
    },
  };
}
