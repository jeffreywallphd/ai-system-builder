import type { IExecutionRunRecord, IExecutionRunSummary } from "@domain/execution/ExecutionRun";

function freezeSummary(summary?: IExecutionRunSummary): IExecutionRunSummary | undefined {
  return summary
    ? Object.freeze({
        ...summary,
        metadata: summary.metadata ? Object.freeze({ ...summary.metadata }) : undefined,
      })
    : undefined;
}

export function freezeExecutionRunRecord(run: IExecutionRunRecord): IExecutionRunRecord {
  return Object.freeze({
    ...run,
    unitIds: Object.freeze([...(run.unitIds ?? [])]),
    units: Object.freeze(Object.fromEntries(
      Object.entries(run.units).map(([unitId, unit]) => [unitId, Object.freeze({
        ...unit,
        dependsOn: Object.freeze([...(unit.dependsOn ?? [])]),
        outputMetadata: unit.outputMetadata ? Object.freeze({ ...unit.outputMetadata }) : undefined,
        outputSummary: freezeSummary(unit.outputSummary),
        provenance: unit.provenance ? Object.freeze({
          ...unit.provenance,
          fallback: unit.provenance.fallback ? Object.freeze({ ...unit.provenance.fallback }) : undefined,
          diagnostics: unit.provenance.diagnostics ? Object.freeze(unit.provenance.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
          metadata: unit.provenance.metadata ? Object.freeze({ ...unit.provenance.metadata }) : undefined,
        }) : undefined,
        diagnostics: unit.diagnostics ? Object.freeze(unit.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
        artifacts: unit.artifacts ? Object.freeze(unit.artifacts.map((artifact) => Object.freeze({ ...artifact }))) : undefined,
      })])
    )),
    transitions: Object.freeze(run.transitions.map((transition) => Object.freeze({
      ...transition,
      provenance: transition.provenance ? Object.freeze({
        ...transition.provenance,
        fallback: transition.provenance.fallback ? Object.freeze({ ...transition.provenance.fallback }) : undefined,
        diagnostics: transition.provenance.diagnostics ? Object.freeze(transition.provenance.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
        metadata: transition.provenance.metadata ? Object.freeze({ ...transition.provenance.metadata }) : undefined,
      }) : undefined,
      diagnostics: transition.diagnostics ? Object.freeze(transition.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))) : undefined,
    }))),
    metadata: run.metadata ? Object.freeze({ ...run.metadata }) : undefined,
    terminalSummary: freezeSummary(run.terminalSummary),
    diagnosticsSummary: freezeSummary(run.diagnosticsSummary),
  });
}

