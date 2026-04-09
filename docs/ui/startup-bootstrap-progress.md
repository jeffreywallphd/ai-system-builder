# Startup bootstrap progress card

The renderer startup card now uses a two-panel layout so users can see both:

1. **Stage checklist (left panel)**: high-level initialization milestones.
2. **Activity log (right panel)**: a terminal-style stream of progress events with timestamps.

## Behavioral notes

- Session language was updated from _saved sign-in_ to _previous session_ for clearer wording.
- The duplicated _Checking your saved sign-in_ checklist entry was replaced by two distinct stages:
  - **Checking for previous session**
  - **Validating previous session**
- The activity log is fed from the same initialization progress event stream as the stage checklist.
- Duplicate consecutive events are ignored to avoid noisy log output.
- The activity log is capped to the most recent 40 events to keep rendering stable.

## Implementation details

- Stage presentation updates live in:
  - `src/ui/shared/initialization/AppInitializationProgress.ts`
- Startup card rendering and activity log buffering live in:
  - `src/ui/App.tsx`
- Styling for the split layout and terminal-like display lives in:
  - `src/ui/styles/app.css`
