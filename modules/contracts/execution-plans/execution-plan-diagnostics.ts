export type ExecutionDiagnosticSeverity = 'info'|'warning'|'error';
export interface ExecutionDiagnostic { code: string; severity: ExecutionDiagnosticSeverity; message: string; }
export interface ExecutionBlocker { code: string; message: string; }
const UNSAFE=/(https?:\/\/|[a-zA-Z]:[\\/]|token|secret|api[-_]?key|private[-_]?key|signature|base64|blob|stack|trace|\/|\\)/i;
function safeText(value:string,label:string){const n=value.trim(); if(!n||UNSAFE.test(n)) throw new Error(`${label} must be sanitized.`); return n;}
export function normalizeExecutionDiagnostic(input: ExecutionDiagnostic): ExecutionDiagnostic { return { code: safeText(input.code,'Diagnostic code'), severity: input.severity, message: safeText(input.message,'Diagnostic message')}; }
export function normalizeExecutionBlocker(input: ExecutionBlocker): ExecutionBlocker { return { code: safeText(input.code,'Blocker code'), message: safeText(input.message,'Blocker message')}; }
