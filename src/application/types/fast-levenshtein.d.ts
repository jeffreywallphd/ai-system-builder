declare module "fast-levenshtein" {
  const api: {
    get(left: string, right: string, options?: { useCollator?: boolean }): number;
  };
  export default api;
}
