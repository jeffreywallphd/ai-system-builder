from __future__ import annotations

import unittest
from unittest.mock import patch

from modules.adapters.runtime.python.worker.models import ExampleGenerationConfig
from modules.adapters.runtime.python.worker.tasks.local_text_generation import (
    _GENERATOR_CACHE,
    get_or_create_local_text_generator,
)


class _FakeTensor:
    def __init__(self, values: list[int]):
        self.values = values
        self.shape = (1, len(values))

    def __getitem__(self, item):
        return self.values[item]

    def to(self, _device):
        return self


class _FakeTokenizer:
    supports_chat = True

    def __call__(self, prompt: str, return_tensors: str = "pt"):
        del return_tensors
        if prompt == "prompt":
            return {"input_ids": _FakeTensor([11, 22, 33])}
        return {"input_ids": _FakeTensor([1, 2, 3])}

    def decode(self, ids, skip_special_tokens: bool = True):
        del skip_special_tokens
        return " ".join(str(token) for token in ids)

    def apply_chat_template(self, _messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"):
        del tokenize, add_generation_prompt, return_tensors
        if not self.supports_chat:
            raise AttributeError("missing")
        return _FakeTensor([7, 8])


class _FakeModel:
    def __init__(self):
        self.device = "cpu"

    def to(self, _device):
        return self

    def generate(self, **kwargs):
        input_ids = kwargs["input_ids"]
        if isinstance(input_ids, _FakeTensor):
            values = input_ids.values
        else:
            values = input_ids
        return [[*values, 44, 55]]


class _FakePipeline:
    def __call__(self, _prompt, **_kwargs):
        return [{"generated_text": "text2text output"}]


class _NoChatTokenizer:
    def __call__(self, _prompt: str, return_tensors: str = "pt"):
        del return_tensors
        return {"input_ids": _FakeTensor([1, 2, 3])}

    def decode(self, ids, skip_special_tokens: bool = True):
        del skip_special_tokens
        return " ".join(str(token) for token in ids)


class LocalTextGenerationTests(unittest.TestCase):
    def setUp(self) -> None:
        _GENERATOR_CACHE.clear()

    def test_text2text_mode_uses_text2text_pipeline_behavior(self) -> None:
        config = ExampleGenerationConfig.model_validate(
            {"mode": "qa", "model": {"provider": "transformers", "modelId": "m", "inferenceMode": "text2text"}}
        )
        with patch(
            "modules.adapters.runtime.python.worker.tasks.local_text_generation.TransformersText2TextGenerator._build_pipeline",
            return_value=_FakePipeline(),
        ):
            generator = get_or_create_local_text_generator(config)

        self.assertEqual(generator.generate_text("prompt"), "text2text output")

    def test_causal_mode_slices_prompt_tokens(self) -> None:
        config = ExampleGenerationConfig.model_validate(
            {"mode": "qa", "model": {"provider": "transformers", "modelId": "m", "inferenceMode": "causal"}}
        )

        with patch(
            "modules.adapters.runtime.python.worker.tasks.local_text_generation.TransformersCausalGenerator._load_model",
            return_value=(_FakeTokenizer(), _FakeModel()),
        ):
            generator = get_or_create_local_text_generator(config)

        self.assertEqual(generator.generate_text("prompt"), "44 55")

    def test_chat_mode_uses_chat_template_when_available(self) -> None:
        config = ExampleGenerationConfig.model_validate(
            {"mode": "qa", "model": {"provider": "transformers", "modelId": "m", "inferenceMode": "chat"}}
        )

        with patch(
            "modules.adapters.runtime.python.worker.tasks.local_text_generation.TransformersCausalGenerator._load_model",
            return_value=(_FakeTokenizer(), _FakeModel()),
        ):
            generator = get_or_create_local_text_generator(config)

        self.assertEqual(generator.generate_text("prompt"), "44 55")

    def test_chat_mode_fails_clearly_without_chat_template(self) -> None:
        config = ExampleGenerationConfig.model_validate(
            {"mode": "qa", "model": {"provider": "transformers", "modelId": "m", "inferenceMode": "chat"}}
        )

        with patch(
            "modules.adapters.runtime.python.worker.tasks.local_text_generation.TransformersCausalGenerator._load_model",
            return_value=(_NoChatTokenizer(), _FakeModel()),
        ):
            generator = get_or_create_local_text_generator(config)

        with self.assertRaisesRegex(RuntimeError, "apply_chat_template"):
            generator.generate_text("prompt")


if __name__ == "__main__":
    unittest.main()
