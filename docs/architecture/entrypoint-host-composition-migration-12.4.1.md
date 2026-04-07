# Entrypoint Host Composition Migration (Story 12.4.1)

This note records the runtime-entrypoint migration completed for Story 12.4.1 so the host framework is the real execution path.

## Entrypoints migrated

- `electron/main/main.ts`
  - Before: started the local identity/control-plane server directly with `startIdentityServerHost(...)`.
  - After: starts the control-plane runtime through `startAuthoritativeServerHostAssembly(...)`.
- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts`
  - Before: started the browser-development identity server directly with `startIdentityServerHost(...)`.
  - After: starts the server through `startAuthoritativeServerHostAssembly(...)`.

## Runtime behavior notes

- Desktop and browser-development runtimes still start a local control-plane server for local identity APIs.
- CORS and bind/port behavior are preserved at the call sites.
- Shutdown now uses host runtime handles (`runtime.stop()`) rather than direct server host handles.

## Why this migration matters

- Primary startup paths now execute through explicit host composition roots.
- Control-plane startup semantics are centralized in one authoritative host assembly entrypoint.
- Duplicate ad-hoc initialization logic in runtime entrypoints is reduced and easier to extend in later host stories.
