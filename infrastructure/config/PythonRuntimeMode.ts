export const PythonRuntimeMode = {
  disabled: "disabled",
  localHttp: "local-http",
} as const;

export type PythonRuntimeMode = (typeof PythonRuntimeMode)[keyof typeof PythonRuntimeMode];

export function parsePythonRuntimeMode(value?: string): PythonRuntimeMode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === "disabled" || normalized === "off") {
    return PythonRuntimeMode.disabled;
  }

  if (["local-http", "local", "python", "http"].includes(normalized)) {
    return PythonRuntimeMode.localHttp;
  }

  throw new Error(`Unsupported python runtime mode '${value}'.`);
}
