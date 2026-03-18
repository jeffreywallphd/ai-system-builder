from app.execution.langchain_executor import LangChainExecutor


def test_text_splitter_generates_chunks() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.text_splitter',
        inputs={'text': 'A' * 120, 'chunk_size': 50, 'chunk_overlap': 10},
        properties={},
    )
    assert len(result['chunks']) >= 2


def test_prompt_template_formats_variables() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.prompt_template',
        inputs={'variables': {'topic': 'workflow orchestration'}},
        properties={'template': 'Explain {topic}.'},
    )
    assert result['prompt'] == 'Explain workflow orchestration.'


def test_llm_chat_returns_deterministic_response() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.llm_chat',
        inputs={'messages': [{'role': 'user', 'content': 'Summarize this graph.'}]},
        properties={'model': 'demo-chat-model'},
    )
    assert result['response'] == '[demo-chat-model] user: Summarize this graph.'


def test_output_parser_removes_prefix() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.output_parser',
        inputs={'output_text': 'Final: normalized value'},
        properties={'format': 'text', 'prefix': 'Final:'},
    )
    assert result['parsed_output'] == 'normalized value'
    assert result['raw_output'] == 'Final: normalized value'
