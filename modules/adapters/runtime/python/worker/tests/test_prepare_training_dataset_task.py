from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from models import PrepareTrainingDatasetRequest
from tasks.prepare_training_dataset import prepare_training_dataset


class PrepareTrainingDatasetTaskTests(unittest.TestCase):
    def test_returns_summary_counts_and_interim_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            first = Path(temp_dir) / "first.txt"
            second = Path(temp_dir) / "second.unsupported"
            first.write_text("abcdefghij", encoding="utf-8")
            second.write_text("unsupported", encoding="utf-8")

            payload = PrepareTrainingDatasetRequest.model_validate(
                {
                    "sourceInputs": [
                        {"artifactId": "doc-1", "localPath": str(first), "mediaType": "text/plain"},
                        {"artifactId": "doc-2", "localPath": str(second), "mediaType": "application/octet-stream"},
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
                    "output": {"format": "jsonl"},
                }
            )

            result = prepare_training_dataset(payload)

            self.assertEqual(result.summary.sourceDocumentCount, 2)
            self.assertEqual(result.summary.normalizedDocumentCount, 1)
            self.assertEqual(result.summary.skippedDocumentCount, 1)
            self.assertEqual(result.summary.chunkCount, 3)
            self.assertEqual(result.summary.generatedExampleCount, 0)
            self.assertEqual(result.summary.trainRowCount + result.summary.testRowCount, 3)
            self.assertTrue(any(warning.code == "generation_not_implemented" for warning in result.warnings or []))


if __name__ == "__main__":
    unittest.main()
