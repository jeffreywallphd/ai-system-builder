from app.execution.langchain_executor import LangChainExecutor


def test_text_splitter_generates_chunks() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.text_splitter',
        inputs={'text': 'A' * 120, 'chunk_size': 50, 'chunk_overlap': 10},
        properties={},
    )
    assert len(result['chunks']) >= 2


def test_simple_chain_is_deterministic() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.simple_chain',
        inputs={'input_text': 'hello'},
        properties={'template': 'Say {input_text}'},
    )
    assert result['result'] == 'deterministic-chain-output::Say hello'



def test_output_parser_removes_prefix() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.output_parser',
        inputs={'output_text': 'Final: normalized value'},
        properties={'prefix': 'Final:'},
    )
    assert result['parsed_output'] == 'normalized value'
    assert result['raw_output'] == 'Final: normalized value'
