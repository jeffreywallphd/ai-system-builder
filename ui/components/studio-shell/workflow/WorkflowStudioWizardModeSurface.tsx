import type { WorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";

export interface WorkflowStudioWizardModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
}

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function renderEmptyState(message: string): JSX.Element {
  return <p className="ui-text-muted">{message}</p>;
}

export default function WorkflowStudioWizardModeSurface({
  sharedDraft,
  sharedDraftSerialized,
}: WorkflowStudioWizardModeSurfaceProps): JSX.Element {
  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-wizard-mode-surface">
      <nav className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }} aria-label="Wizard sections">
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-trigger">Trigger</a>
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-inputs">Inputs</a>
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-steps">Steps</a>
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-outputs">Outputs</a>
      </nav>

      <WizardSection sectionId="workflow-wizard-trigger">
        <SectionHeader
          title="Trigger Section"
          description="Define what starts workflow execution. This section is bound to the shared workflow draft triggers array."
        />
        <SectionBody>
          <div className="ui-text-small">{buildSectionSummary(sharedDraft.triggers.length, "trigger", "triggers")}</div>
          {sharedDraft.triggers.length === 0
            ? renderEmptyState("No triggers configured yet.")
            : (
              <ul className="ui-stack ui-stack--2xs">
                {sharedDraft.triggers.map((trigger) => (
                  <li key={trigger.id}>{trigger.id}: {trigger.type}</li>
                ))}
              </ul>
            )}
        </SectionBody>
      </WizardSection>

      <WizardSection sectionId="workflow-wizard-inputs">
        <SectionHeader
          title="Inputs Section"
          description="Capture runtime inputs consumed by the workflow. This section reads from the shared workflow draft inputs array."
        />
        <SectionBody>
          <div className="ui-text-small">{buildSectionSummary(sharedDraft.inputs.length, "input", "inputs")}</div>
          {sharedDraft.inputs.length === 0
            ? renderEmptyState("No inputs configured yet.")
            : (
              <ul className="ui-stack ui-stack--2xs">
                {sharedDraft.inputs.map((input) => (
                  <li key={input.id}>{input.id}: {input.sourceType}</li>
                ))}
              </ul>
            )}
        </SectionBody>
      </WizardSection>

      <WizardSection sectionId="workflow-wizard-steps">
        <SectionHeader
          title="Steps Section"
          description="Describe workflow execution steps in order. This section is backed by the shared workflow draft steps array."
        />
        <SectionBody>
          <div className="ui-text-small">{buildSectionSummary(sharedDraft.steps.length, "step", "steps")}</div>
          {sharedDraft.steps.length === 0
            ? renderEmptyState("No steps configured yet.")
            : (
              <ol className="ui-stack ui-stack--2xs">
                {sharedDraft.steps.map((step) => (
                  <li key={step.id}>{step.title || step.id}</li>
                ))}
              </ol>
            )}
        </SectionBody>
      </WizardSection>

      <WizardSection sectionId="workflow-wizard-outputs">
        <SectionHeader
          title="Outputs Section"
          description="Define workflow outputs and destinations. This section reflects the shared workflow draft outputs array."
        />
        <SectionBody>
          <div className="ui-text-small">{buildSectionSummary(sharedDraft.outputs.length, "output", "outputs")}</div>
          {sharedDraft.outputs.length === 0
            ? renderEmptyState("No outputs configured yet.")
            : (
              <ul className="ui-stack ui-stack--2xs">
                {sharedDraft.outputs.map((output) => (
                  <li key={output.id}>{output.id}: {output.outputType}</li>
                ))}
              </ul>
            )}
        </SectionBody>
      </WizardSection>

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Shared canonical workflow draft JSON preview</span>
        <textarea className="ui-textarea" rows={8} value={sharedDraftSerialized} readOnly />
      </label>
    </div>
  );
}
