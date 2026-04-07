export const PythonRuntimeMode = {
  disabled: "disabled",
  externalHttp: "external-http",
  managedLocal: "managed-local",
  localHttp: "managed-local",
} as const;

export type PythonRuntimeMode = (typeof PythonRuntimeMode)[keyof typeof PythonRuntimeMode];

export function parsePythonRuntimeMode(value?: string): PythonRuntimeMode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === "disabled" || normalized === "off") {
    return PythonRuntimeMode.disabled;
  }

  if (["external-http", "external", "external-http-runtime"].includes(normalized)) {
    return PythonRuntimeMode.externalHttp;
  }

  if (["managed-local", "managed", "local-http", "local", "python", "http"].includes(normalized)) {
    return PythonRuntimeMode.managedLocal;
  }

  throw new Error(
    `Unsupported python runtime mode '${value}'. Expected one of: disabled, external-http, managed-local.`
  );
}
