// Compatibility shim: imports should migrate to
// `src/ui/composition/legacy/LegacyBrowserFallbackRepositories.ts`.
export {
  resolveLegacyBrowserStudioShellRepository as resolveBrowserStudioShellRepository,
  resolveLegacyBrowserWorkflowPersistenceRepository as resolveBrowserWorkflowPersistenceRepository,
  resolveLegacyBrowserWorkflowRunSummaryRepository as resolveBrowserWorkflowRunSummaryRepository,
} from "./legacy/LegacyBrowserFallbackRepositories";
