from __future__ import annotations

from typing import Any, Dict, List
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter


class LangChainExecutor:
    def execute(self, node_type: str, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        if node_type == "langchain.prompt_template":
            template = str(properties.get("template") or inputs.get("template") or "{input}")
            variables = dict(inputs.get("variables") or properties.get("variables") or {})
            prompt = PromptTemplate.from_template(template)
            return {"formatted_prompt": prompt.format(**variables)}

        if node_type == "langchain.text_splitter":
            text = str(inputs.get("text") or properties.get("text") or "")
            chunk_size = int(properties.get("chunk_size") or inputs.get("chunk_size") or 500)
            chunk_overlap = int(properties.get("chunk_overlap") or inputs.get("chunk_overlap") or 50)
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            chunks = splitter.split_text(text)
            return {"chunks": chunks}

        if node_type == "langchain.document_to_chunks":
            text = str(inputs.get("text") or properties.get("text") or "")
            metadata = dict(inputs.get("metadata") or properties.get("metadata") or {})
            chunk_size = int(properties.get("chunk_size") or 500)
            chunk_overlap = int(properties.get("chunk_overlap") or 50)
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            chunks = splitter.split_text(text)
            return {
                "chunks": [
                    {"index": index, "text": chunk, "metadata": metadata}
                    for index, chunk in enumerate(chunks)
                ]
            }

        if node_type == "langchain.chat_prompt":
            system_prompt = str(inputs.get("system_prompt") or properties.get("system_prompt") or "")
            user_prompt = str(inputs.get("user_prompt") or properties.get("user_prompt") or "")
            context_blocks: List[str] = list(inputs.get("context_blocks") or properties.get("context_blocks") or [])
            context_text = "\n\n".join(context_blocks)
            chat_prompt = ChatPromptTemplate.from_messages([
                ("system", "{system_prompt}"),
                ("human", "{user_prompt}\n\nContext:\n{context_text}"),
            ])
            messages = chat_prompt.format_messages(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                context_text=context_text,
            )
            return {
                "messages": [
                    {"type": message.type, "content": str(message.content)}
                    for message in messages
                ]
            }

        if node_type == "langchain.simple_chain":
            template = str(properties.get("template") or "Echo chain: {input_text}")
            input_text = str(inputs.get("input_text") or "")
            prompt = PromptTemplate.from_template(template)
            rendered = prompt.format(input_text=input_text)
            return {
                "rendered_prompt": rendered,
                "result": f"deterministic-chain-output::{rendered}",
            }

        if node_type == "langchain.context_merger":
            context_blocks: List[str] = list(inputs.get("context_blocks") or properties.get("context_blocks") or [])
            separator = str(properties.get("separator") or inputs.get("separator") or "\n\n")
            merged_context = separator.join([str(block) for block in context_blocks])
            return {
                "merged_context": merged_context,
                "block_count": len(context_blocks),
            }

        if node_type == "langchain.output_parser":
            output_text = str(inputs.get("output_text") or properties.get("output_text") or "")
            prefix = str(properties.get("prefix") or inputs.get("prefix") or "")
            normalized = output_text.strip()
            if prefix and normalized.startswith(prefix):
                normalized = normalized[len(prefix):].strip()
            return {
                "parsed_output": normalized,
                "raw_output": output_text,
            }

        raise ValueError(f"Unsupported langchain node type: {node_type}")
