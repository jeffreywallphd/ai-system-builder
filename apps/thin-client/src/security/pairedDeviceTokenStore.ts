const KEY = "ai-system-builder.paired-device-token";
export const pairedDeviceTokenStore = {
  getToken: () => localStorage.getItem(KEY),
  setToken: (token: string) => localStorage.setItem(KEY, token),
  clearToken: () => localStorage.removeItem(KEY),
  hasToken: () => !!localStorage.getItem(KEY),
};
