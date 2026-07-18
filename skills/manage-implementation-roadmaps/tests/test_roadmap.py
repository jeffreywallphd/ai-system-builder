from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "roadmap.py"
SPEC = importlib.util.spec_from_file_location("roadmap_engine", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load roadmap engine.")
roadmap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(roadmap)


def increment_definition(
    identifier: str,
    number: int,
    *,
    depends_on: list[str] | None = None,
    qualification: str = "local",
    allow_pending: bool = False,
) -> dict:
    return {
        "id": identifier,
        "number": number,
        "title": f"Increment {number}",
        "objective": f"Deliver verified outcome {number}.",
        "dependsOn": depends_on or [],
        "workPackages": [
            {
                "id": f"work-{number}",
                "title": f"Work {number}",
                "outcome": f"Outcome {number} is implemented.",
            }
        ],
        "deliverables": [f"Deliverable {number}"],
        "acceptanceCriteria": [
            {
                "id": f"criterion-{number}",
                "description": f"Criterion {number} is satisfied.",
                "qualification": qualification,
            }
        ],
        "verification": [f"Run verification {number}."],
        "rollback": f"Revert increment {number}.",
        "excluded": ["Unrelated scope"],
        "allowPendingQualification": allow_pending,
    }


def implementation_plan(number: int) -> dict:
    return {
        "summary": f"Implement increment {number} as one coherent testable slice.",
        "steps": [f"Implement outcome {number}.", f"Verify outcome {number}."],
        "chunks": [
            {
                "id": f"chunk-{number}",
                "title": f"Chunk {number}",
                "outcome": f"Outcome {number} works end to end.",
                "criteriaIds": [f"criterion-{number}"],
            }
        ],
        "tests": [f"Focused test {number}", "Repository gates"],
        "documentation": [f"Documentation {number}"],
        "rollback": f"Remove the increment {number} slice.",
        "assumptions": ["The approved scope remains unchanged."],
    }


class RoadmapEngineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name).resolve()
        self.state = roadmap.initial_state(
            self.repo,
            {
                "name": "Portable Roadmap",
                "slug": "portable-roadmap",
                "objective": "Deliver a portable verified roadmap workflow.",
            },
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def apply(self, event: dict) -> None:
        self.state = roadmap.apply_event(self.state, event)
        roadmap.validate_state_shape(self.repo, self.state)

    def define_and_approve(self, increments: list[dict]) -> None:
        self.apply(
            {
                "type": "discovery-recorded",
                "summary": "Repository and primary-source research is complete.",
                "sources": [{"title": "Repository guidance"}],
                "constraints": ["Preserve approved dependency direction."],
                "decisionRequired": False,
            }
        )
        self.apply({"type": "roadmap-defined", "increments": increments})
        self.apply(
            {
                "type": "roadmap-approved",
                "note": "The user explicitly approved this roadmap.",
            }
        )

    def execute_increment(self, number: int, outcome: str = "passed") -> None:
        identifier = f"increment-{number}"
        self.apply({"type": "increment-started", "incrementId": identifier})
        self.apply(
            {
                "type": "increment-research-recorded",
                "summary": f"Increment {number} research is complete.",
                "sources": [{"title": f"Source {number}"}],
                "risks": [f"Risk {number} is covered by a regression test."],
            }
        )
        self.apply(
            {
                "type": "increment-plan-recorded",
                "plan": implementation_plan(number),
            }
        )
        self.apply(
            {
                "type": "chunk-recorded",
                "chunkId": f"chunk-{number}",
                "summary": f"Chunk {number} is implemented.",
                "areas": [f"Area {number}"],
                "tests": [f"Focused test {number} passed."],
                "documentation": [f"Documentation {number} updated."],
                "feedbackAddressed": [],
            }
        )
        self.apply(
            {
                "type": "evidence-recorded",
                "incrementId": identifier,
                "criterionId": f"criterion-{number}",
                "kind": "test" if outcome != "pending" else "external",
                "outcome": outcome,
                "summary": f"Criterion {number} evidence is {outcome}.",
            }
        )
        self.apply(
            {
                "type": "increment-completed",
                "summary": f"Increment {number} is accounted for.",
            }
        )

    def test_two_increment_happy_path_renders_durable_artifacts(self) -> None:
        self.define_and_approve(
            [
                increment_definition("increment-1", 1),
                increment_definition(
                    "increment-2", 2, depends_on=["increment-1"]
                ),
            ]
        )
        self.execute_increment(1)
        self.execute_increment(2)
        self.apply(
            {
                "type": "roadmap-completed",
                "summary": "All increments and evidence are complete.",
            }
        )
        roadmap.write_project_files(self.repo, self.state)
        roadmap.ensure_documents_match(self.repo, self.state)

        report = (
            self.repo / self.state["paths"]["report"]
        ).read_text(encoding="utf-8")
        rendered_roadmap = (
            self.repo / self.state["paths"]["roadmap"]
        ).read_text(encoding="utf-8")
        self.assertEqual(self.state["status"], "completed")
        self.assertIn("## Completed chunks", report)
        self.assertIn("Chunk 2", report)
        self.assertIn("## Increment 2: Increment 2", rendered_roadmap)
        self.assertIn("**passed**", report)

    def test_cannot_skip_the_next_increment(self) -> None:
        self.define_and_approve(
            [
                increment_definition("increment-1", 1),
                increment_definition(
                    "increment-2", 2, depends_on=["increment-1"]
                ),
            ]
        )
        with self.assertRaisesRegex(roadmap.RoadmapError, "skipping"):
            self.apply(
                {"type": "increment-started", "incrementId": "increment-2"}
            )

    def test_decision_requires_two_to_three_options_and_one_recommendation(self) -> None:
        self.apply(
            {
                "type": "discovery-recorded",
                "summary": "A high-level choice is required.",
                "sources": [],
                "constraints": [],
                "decisionRequired": True,
            }
        )
        with self.assertRaisesRegex(roadmap.RoadmapError, "at least 2"):
            self.apply(
                {
                    "type": "decision-proposed",
                    "decision": {
                        "id": "boundary",
                        "title": "Boundary",
                        "question": "Which boundary?",
                        "context": "The boundary changes ownership.",
                        "options": [
                            {
                                "id": "one",
                                "label": "One",
                                "summary": "Only option.",
                                "tradeoffs": [],
                                "consequences": [],
                                "recommended": True,
                            }
                        ],
                    },
                }
            )
        with self.assertRaisesRegex(roadmap.RoadmapError, "Exactly one"):
            self.apply(
                {
                    "type": "decision-proposed",
                    "decision": {
                        "id": "boundary",
                        "title": "Boundary",
                        "question": "Which boundary?",
                        "context": "The boundary changes ownership.",
                        "options": [
                            {
                                "id": "one",
                                "label": "One",
                                "summary": "First option.",
                                "tradeoffs": [],
                                "consequences": [],
                                "recommended": True,
                            },
                            {
                                "id": "two",
                                "label": "Two",
                                "summary": "Second option.",
                                "tradeoffs": [],
                                "consequences": [],
                                "recommended": True,
                            },
                        ],
                    },
                }
            )

    def test_high_level_feedback_invalidates_then_renews_approval(self) -> None:
        self.define_and_approve([increment_definition("increment-1", 1)])
        self.apply(
            {"type": "increment-started", "incrementId": "increment-1"}
        )
        self.apply(
            {
                "type": "feedback-recorded",
                "id": "feedback-1",
                "summary": "The user requested a renewed high-level choice.",
                "category": "decision",
                "impact": "high-level",
                "targetIncrementId": "increment-1",
                "disposition": "needs-decision",
                "nextAction": "Present options and obtain approval.",
            }
        )
        self.assertEqual(self.state["status"], "approval-required")
        self.assertIsNone(self.state["roadmapApproval"])
        self.assertEqual(
            self.state["increments"][0]["status"], "paused-for-approval"
        )
        with self.assertRaisesRegex(roadmap.RoadmapError, "Renew roadmap approval"):
            self.apply(
                {
                    "type": "increment-completed",
                    "summary": "This must not bypass stale approval.",
                }
            )
        self.apply(
            {
                "type": "decision-proposed",
                "decision": {
                    "id": "recovery-choice",
                    "title": "Recovery choice",
                    "question": "How should the approved intent continue?",
                    "context": "The user requested a high-level checkpoint.",
                    "options": [
                        {
                            "id": "continue",
                            "label": "Continue",
                            "summary": "Continue within the existing increment.",
                            "tradeoffs": ["No roadmap shape change"],
                            "consequences": ["Resume research"],
                            "recommended": True,
                        },
                        {
                            "id": "successor",
                            "label": "Successor roadmap",
                            "summary": "Stop and define a successor roadmap.",
                            "tradeoffs": ["More planning"],
                            "consequences": ["Current roadmap remains paused"],
                            "recommended": False,
                        },
                    ],
                },
            }
        )
        self.apply(
            {
                "type": "decision-approved",
                "decisionId": "recovery-choice",
                "optionId": "continue",
            }
        )
        self.apply({"type": "roadmap-approved"})
        self.assertEqual(self.state["status"], "executing")
        self.assertEqual(self.state["increments"][0]["status"], "researching")

    def test_pending_controlled_evidence_promotes_after_later_pass(self) -> None:
        self.define_and_approve(
            [
                increment_definition(
                    "increment-1",
                    1,
                    qualification="controlled-environment",
                    allow_pending=True,
                )
            ]
        )
        self.execute_increment(1, outcome="pending")
        self.assertEqual(
            self.state["increments"][0]["status"],
            "implemented-pending-qualification",
        )
        self.assertEqual(
            self.state["status"],
            "implementation-complete-qualification-pending",
        )
        self.apply(
            {
                "type": "evidence-recorded",
                "incrementId": "increment-1",
                "criterionId": "criterion-1",
                "kind": "external",
                "outcome": "passed",
                "summary": "Controlled-environment qualification passed.",
            }
        )
        self.assertEqual(self.state["increments"][0]["status"], "completed")
        self.assertEqual(self.state["status"], "roadmap-ready-to-close")

    def test_paths_cannot_escape_repository(self) -> None:
        with self.assertRaisesRegex(roadmap.RoadmapError, "inside the repository"):
            roadmap.initial_state(
                self.repo,
                {
                    "name": "Unsafe",
                    "slug": "unsafe",
                    "objective": "Attempt to escape.",
                    "reportPath": "../outside.md",
                },
            )

    def test_unknown_fields_and_event_types_are_rejected(self) -> None:
        with self.assertRaisesRegex(roadmap.RoadmapError, "unsupported field"):
            self.apply(
                {
                    "type": "discovery-recorded",
                    "summary": "Discovery.",
                    "sources": [],
                    "constraints": [],
                    "decisionRequired": False,
                    "command": "do-not-run",
                }
            )
        with self.assertRaisesRegex(roadmap.RoadmapError, "Unsupported event type"):
            self.apply({"type": "execute-command", "command": "do-not-run"})

    def test_sources_and_nested_arrays_are_strictly_validated(self) -> None:
        with self.assertRaisesRegex(roadmap.RoadmapError, "array"):
            self.apply(
                {
                    "type": "discovery-recorded",
                    "summary": "Invalid nested array.",
                    "sources": "not-an-array",
                    "constraints": [],
                    "decisionRequired": False,
                }
            )
        with self.assertRaisesRegex(roadmap.RoadmapError, "unsupported link scheme"):
            self.apply(
                {
                    "type": "discovery-recorded",
                    "summary": "Invalid source scheme.",
                    "sources": [
                        {
                            "title": "Unsafe local source",
                            "url": "file:///private/source",
                        }
                    ],
                    "constraints": [],
                    "decisionRequired": False,
                }
            )

    def test_evidence_command_is_never_executed(self) -> None:
        self.define_and_approve([increment_definition("increment-1", 1)])
        self.apply(
            {"type": "increment-started", "incrementId": "increment-1"}
        )
        marker = self.repo / "must-not-exist"
        self.apply(
            {
                "type": "evidence-recorded",
                "incrementId": "increment-1",
                "criterionId": "criterion-1",
                "kind": "manual",
                "outcome": "passed",
                "summary": "A descriptive evidence record.",
                "command": f"create {marker}",
            }
        )
        self.assertFalse(marker.exists())

    def test_validate_detects_drift_and_render_repairs_it(self) -> None:
        roadmap.write_project_files(self.repo, self.state)
        report_path = self.repo / self.state["paths"]["report"]
        report_path.write_text("manual edit\n", encoding="utf-8")
        with self.assertRaisesRegex(roadmap.RoadmapError, "drift"):
            roadmap.ensure_documents_match(self.repo, self.state)

        roadmap.command_render(
            argparse.Namespace(
                repo=str(self.repo),
                state=self.state["paths"]["state"],
                dry_run=False,
            )
        )
        roadmap.ensure_documents_match(self.repo, self.state)

    def test_state_is_written_before_generated_documents(self) -> None:
        writes: list[Path] = []
        original_atomic_write = roadmap.atomic_write
        try:
            roadmap.atomic_write = lambda path, content: writes.append(path)
            roadmap.write_project_files(self.repo, self.state)
        finally:
            roadmap.atomic_write = original_atomic_write
        self.assertEqual(
            writes[0],
            self.repo / self.state["paths"]["state"],
        )
        self.assertEqual(len(writes), 3)

    def test_empty_and_completed_roadmaps_reject_completion_events(self) -> None:
        with self.assertRaisesRegex(roadmap.RoadmapError, "at least one increment"):
            self.apply(
                {
                    "type": "roadmap-completed",
                    "summary": "An empty roadmap cannot be complete.",
                }
            )
        self.define_and_approve([increment_definition("increment-1", 1)])
        self.execute_increment(1)
        self.apply(
            {
                "type": "roadmap-completed",
                "summary": "The one increment roadmap is complete.",
            }
        )
        with self.assertRaisesRegex(roadmap.RoadmapError, "immutable"):
            self.apply(
                {
                    "type": "feedback-recorded",
                    "id": "late-feedback",
                    "summary": "New scope belongs in a successor roadmap.",
                    "category": "scope",
                    "impact": "scope-change",
                    "targetIncrementId": "increment-1",
                    "disposition": "needs-decision",
                    "nextAction": "Create a successor roadmap.",
                }
            )

    def test_cli_init_apply_validate_and_status(self) -> None:
        cli_repo = self.repo / "cli-repo"
        cli_repo.mkdir()
        config_path = self.repo / "config.json"
        event_path = self.repo / "event.json"
        config_path.write_text(
            json.dumps(
                {
                    "name": "CLI Roadmap",
                    "slug": "cli-roadmap",
                    "objective": "Exercise the public command-line workflow.",
                }
            ),
            encoding="utf-8",
        )

        def run_cli(*arguments: str) -> dict:
            result = subprocess.run(
                [sys.executable, str(MODULE_PATH), *arguments],
                cwd=self.repo,
                capture_output=True,
                check=False,
                encoding="utf-8",
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)

        initialized = run_cli(
            "init",
            "--repo",
            str(cli_repo),
            "--config",
            str(config_path),
        )
        state_relative = ".implementation-roadmaps/cli-roadmap/state.json"
        self.assertEqual(initialized["status"], "discovery")
        self.assertTrue(Path(initialized["reportPath"]).is_absolute())

        event_path.write_text(
            json.dumps(
                {
                    "type": "discovery-recorded",
                    "summary": "CLI discovery is complete.",
                    "sources": [],
                    "constraints": [],
                    "decisionRequired": False,
                }
            ),
            encoding="utf-8",
        )
        applied = run_cli(
            "apply",
            "--repo",
            str(cli_repo),
            "--state",
            state_relative,
            "--event-file",
            str(event_path),
        )
        self.assertEqual(applied["status"], "roadmap-drafting")
        validated = run_cli(
            "validate",
            "--repo",
            str(cli_repo),
            "--state",
            state_relative,
        )
        self.assertTrue(validated["valid"])
        status = run_cli(
            "status",
            "--repo",
            str(cli_repo),
            "--state",
            state_relative,
        )
        self.assertIn("Define the increments", status["nextCheckpoint"])


if __name__ == "__main__":
    unittest.main()
