export const BuildAutomationIntentQueryKey = "automationIntent";

function withSearchParam(path: string, key: string, value: string): string {
  const [routePath, search] = path.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set(key, value);
  return `${routePath}?${params.toString()}`;
}

export function appendAutomationIntentToPath(path: string, intent: string): string {
  const normalizedIntent = intent.trim();
  if (!normalizedIntent) {
    return path;
  }
  return withSearchParam(path, BuildAutomationIntentQueryKey, normalizedIntent);
}

export function readAutomationIntentFromSearch(search: string): string | undefined {
  const value = new URLSearchParams(search).get(BuildAutomationIntentQueryKey)?.trim();
  return value ? value : undefined;
}
