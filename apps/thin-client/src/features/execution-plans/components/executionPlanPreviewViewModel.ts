const statusLabels: Record<string,string> = {draft:'Draft',preparing:'Preparing','ready-for-review':'Ready for review','needs-setup':'Needs setup','missing-inputs':'Missing input','missing-outputs':'Missing output','provider-setup-required':'Provider setup required','safety-review-required':'Safety review required',blocked:'Blocked',stale:'Refresh needed',invalid:'Invalid',archived:'Archived'};
export const mapStatus=(s?:string)=>statusLabels[s??'']??'Draft';
export const safeText=(v:unknown,fallback='Not available')=>typeof v==='string'&&v.trim()?v.trim():fallback;

type PlanSummary={executionPlanId:string;executionPlanStatus:string;updatedAt:string;stepCount:number;missingInputCount:number;missingOutputCount:number;providerSetupRequiredCount:number;safetyReviewRequiredCount:number;blockerCount:number;diagnosticCount:number};
type Detail={summary:PlanSummary;stepSummaries:Array<{label?:string;stepStatus?:string;summary?:string}>;diagnostics:Array<{message?:string}>;resourceEstimateSummaries:unknown[]};

export function mapPreview(latest: PlanSummary|undefined, detail: Detail|undefined){
  const summary=detail?.summary ?? latest;
  return {id:summary?.executionPlanId??'',statusLabel:mapStatus(summary?.executionPlanStatus),updatedAt:summary?.updatedAt??'',counts:{steps:summary?.stepCount??0,missingInputs:summary?.missingInputCount??0,missingOutputs:summary?.missingOutputCount??0,providerSetupRequired:summary?.providerSetupRequiredCount??0,safetyReviewRequired:summary?.safetyReviewRequiredCount??0,blockers:summary?.blockerCount??0,diagnostics:summary?.diagnosticCount??0},steps:(detail?.stepSummaries??[]).map((x)=>({label:safeText(x.label,'Planned step'),status:mapStatus(x.stepStatus),summary:typeof x.summary==='string'?x.summary:''})),issues:(detail?.diagnostics??[]).map((x)=>safeText(x.message,'Needs review')),estimates:detail?.resourceEstimateSummaries??[]};
}
