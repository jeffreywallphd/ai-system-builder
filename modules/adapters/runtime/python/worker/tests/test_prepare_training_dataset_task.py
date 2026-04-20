from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from modules.adapters.runtime.python.worker.models import PrepareTrainingDatasetRequest
from modules.adapters.runtime.python.worker.tasks.example_generation import GeneratedQaExample
from modules.adapters.runtime.python.worker.tasks.prepare_training_dataset import prepare_training_dataset


class PrepareTrainingDatasetTaskTests(unittest.TestCase):
    def _build_payload(self, output_format: str) -> PrepareTrainingDatasetRequest:
        return PrepareTrainingDatasetRequest.model_validate(
            {
                "sourceInputs": [
                    {"artifactId": "doc-1", "localPath": self.first_path, "mediaType": "text/plain"},
                    {"artifactId": "doc-2", "localPath": self.second_path, "mediaType": "application/octet-stream"},
                ],
                "recipe": {
                    "normalization": {
                        "targetFormat": "markdown",
                        "unsupportedDocumentPolicy": "skip",
                    },
                    "chunking": {
                        "strategy": "character",
                        "chunkSize": 4,
                        "chunkOverlap": 1,
                        "preserveDocumentBoundaries": True,
                    },
                    "generation": {
                        "mode": "qa",
                        "model": {"provider": "transformers", "modelId": "test-model"},
                    },
                },
                "split": {"trainRatio": 0.5, "testRatio": 0.5, "shuffle": False},
                "output": {"format": output_format},
            }
        )

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        first = Path(self.temp_dir.name) / "first.txt"
        second = Path(self.temp_dir.name) / "second.unsupported"
        first.write_text("abcdefghij", encoding="utf-8")
        second.write_text("unsupported", encoding="utf-8")
        self.first_path = str(first)
        self.second_path = str(second)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_returns_generated_examples_summary_and_warning_from_normalization(self) -> None:
        payload = self._build_payload("jsonl")

        def generator(chunks, _config):
            return [
                GeneratedQaExample(
                    artifact_id=chunk.artifact_id,
                    chunk_index=chunk.chunk_index,
                    question=f"Q{chunk.chunk_index}",
                    answer=chunk.text,
                )
                for chunk in chunks
            ]

        result = prepare_training_dataset(payload, example_generator=generator)

        self.assertEqual(result.summary.sourceDocumentCount, 2)
        self.assertEqual(result.summary.normalizedDocumentCount, 1)
        self.assertEqual(result.summary.skippedDocumentCount, 1)
        self.assertEqual(result.summary.chunkCount, 3)
        self.assertEqual(result.summary.generatedExampleCount, 3)
        self.assertEqual(result.summary.trainRowCount, 1)
        self.assertEqual(result.summary.testRowCount, 2)
        self.assertTrue(any(warning.code == "document_normalization_skipped" for warning in result.warnings or []))

    def test_writes_generated_schema_as_jsonl_json_and_csv(self) -> None:
        def generator(chunks, _config):
            return [
                GeneratedQaExample(
                    artifact_id=chunk.artifact_id,
                    chunk_index=chunk.chunk_index,
                    question="What is this chunk about?",
                    answer=chunk.text,
                )
                for chunk in chunks
            ]

        for output_format in ["jsonl", "json", "csv"]:
            payload = self._build_payload(output_format)
            result = prepare_training_dataset(payload, example_generator=generator)

            train_output = next(output for output in result.outputs if output.role == "train")
            contents = Path(train_output.tempPath).read_text(encoding="utf-8")

            if output_format == "jsonl":
                first_row = json.loads(contents.splitlines()[0])
                self.assertEqual(set(first_row.keys()), {"artifactId", "chunkIndex", "question", "answer", "generationMode"})
            elif output_format == "json":
                first_row = json.loads(contents)[0]
                self.assertEqual(set(first_row.keys()), {"artifactId", "chunkIndex", "question", "answer", "generationMode"})
            else:
                reader = csv.DictReader(contents.splitlines())
                self.assertEqual(reader.fieldnames, ["artifactId", "chunkIndex", "question", "answer", "generationMode"])


if __name__ == "__main__":
    unittest.main()
