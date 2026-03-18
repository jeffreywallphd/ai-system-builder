from __future__ import annotations

from typing import Any, Dict, List
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter


class LangChainExecutor:
    def execute(self, node_type: str, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        if node_type in {"langchain.prompt_template", "langchain.prompt-template"}:
            template = str(properties.get("template") or inputs.get("template") or "{input}")
            variables = dict(inputs.get("variables") or inputs.get("template-input") or properties.get("variables") or {})
            prompt = PromptTemplate.from_template(template)
            formatted = prompt.format(**variables)
            return {"prompt": formatted, "formatted_prompt": formatted}

        if node_type in {"langchain.text_splitter", "langchain.text-splitter"}:
            text = str(inputs.get("text") or properties.get("text") or "")
            chunk_size = int(properties.get("chunkSize") or properties.get("chunk-size") or inputs.get("chunk_size") or 500)
            chunk_overlap = int(properties.get("chunkOverlap") or properties.get("chunk-overlap") or inputs.get("chunk_overlap") or 50)
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

        if node_type in {"langchain.chat_prompt", "langchain.chat-prompt"}:
            system_prompt = str(inputs.get("system") or properties.get("system") or "")
            user_prompt = str(inputs.get("user") or properties.get("user") or "")
            context_value = inputs.get("context") or properties.get("context") or ""
            history = list(inputs.get("history") or []) if bool(properties.get("includeHistory", properties.get("include-history", True))) else []
            include_context = bool(properties.get("includeContext", True))
            context_text = str(context_value) if include_context else ""
            chat_prompt = ChatPromptTemplate.from_messages([
                ("system", "{system_prompt}"),
                ("human", "{user_prompt}{context_suffix}"),
            ])
            messages = chat_prompt.format_messages(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                context_suffix=f"\n\nContext:\n{context_text}" if context_text else "",
            )
            rendered = [{"role": message.type if message.type != "human" else "user", "content": str(message.content)} for message in messages]
            rendered[1:1] = history
            return {"messages": rendered}

        if node_type == "langchain.llm_chat":
            prompt = str(inputs.get("prompt") or "")
            messages = list(inputs.get("messages") or [])
            model = str(properties.get("model") or "deterministic-model")
            source = "\n".join(f"{message.get('role', 'user')}: {message.get('content', '')}" for message in messages) if messages else prompt
            return {
                "response": f"[{model}] {source}" if source else "",
                "raw": {
                    "model": model,
                    "temperature": float(properties.get("temperature", 0.7)),
                    "maxTokens": properties.get("maxTokens"),
                    "topP": properties.get("topP"),
                    "inputMode": "messages" if messages else "prompt",
                },
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

        if node_type in {"langchain.output_parser", "langchain.output-parser"}:
            output_text = str(inputs.get("text") or inputs.get("output_text") or properties.get("output_text") or "")
            prefix = str(properties.get("prefix") or inputs.get("prefix") or "")
            normalized = output_text.strip()
            if prefix and normalized.startswith(prefix):
                normalized = normalized[len(prefix):].strip()
            if str(properties.get("format") or "json") == "json":
                try:
                    import json
                    parsed: Any = json.loads(normalized)
                except Exception:
                    parsed = {"text": normalized}
            else:
                parsed = normalized
            return {
                "parsed": parsed,
                "parsed_output": parsed,
                "raw_output": output_text,
            }

        raise ValueError(f"Unsupported langchain node type: {node_type}")
