from __future__ import annotations

import json
from math import sqrt
from typing import Any, Dict, List

from langchain_core.documents import Document as LangChainDocument
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from langchain.chains.summarize import load_summarize_chain  # type: ignore
except Exception:  # pragma: no cover - optional dependency in this runtime image
    load_summarize_chain = None


class _DeterministicVectorStore:
    def __init__(self) -> None:
        self._documents: List[LangChainDocument] = []

    def add_documents(self, documents: List[LangChainDocument]) -> List[str]:
        self._documents.extend(documents)
        return [str(index + 1) for index in range(len(documents))]

    def similarity_search(self, query: str, k: int = 4) -> List[LangChainDocument]:
        query_tokens = {token for token in query.lower().split() if token}
        scored: List[tuple[float, LangChainDocument]] = []
        for document in self._documents:
            candidate_tokens = {token for token in document.page_content.lower().split() if token}
            score = 0.0 if not query_tokens else len(query_tokens & candidate_tokens) / len(query_tokens)
            scored.append((score, document))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [document for score, document in scored[:k] if score > 0 or not query_tokens]


def _normalize_document(item: Any, default_id: str) -> Dict[str, Any]:
    if isinstance(item, str):
        return {"id": default_id, "content": item, "metadata": {}}
    if isinstance(item, dict):
        content = item.get("content") or item.get("text") or item.get("page_content") or ""
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        return {
            "id": str(item.get("id") or default_id),
            "content": str(content),
            "metadata": metadata,
        }
    return {"id": default_id, "content": str(item), "metadata": {}}


def _normalize_documents(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [_normalize_document(item, f"doc-{index + 1}") for index, item in enumerate(value)]


class _DeterministicLlm:
    def __init__(self, label: str) -> None:
        self.label = label

    def invoke(self, prompt: Any, **_: Any) -> str:
        text = prompt if isinstance(prompt, str) else str(prompt)
        return f"[{self.label}] {text[:300]}"

    def __call__(self, *args: Any, **kwargs: Any) -> str:
        prompt = args[0] if args else kwargs.get("input") or ""
        return self.invoke(prompt)


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
            documents = _normalize_documents(inputs.get("documents") or [])
            if not documents:
                text = str(inputs.get("text") or properties.get("text") or "")
                metadata = dict(inputs.get("metadata") or properties.get("metadata") or {})
                documents = [{"id": "doc-1", "content": text, "metadata": metadata}]
            chunk_size = int(properties.get("chunk_size") or properties.get("chunkSize") or 500)
            chunk_overlap = int(properties.get("chunk_overlap") or properties.get("chunkOverlap") or 50)
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            chunks: List[Dict[str, Any]] = []
            for document in documents:
                for index, chunk in enumerate(splitter.split_text(document["content"])):
                    chunks.append({
                        "index": index,
                        "text": chunk,
                        "metadata": document["metadata"],
                    })
            return {"chunks": chunks}

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

        if node_type == "langchain.vector_store_upsert":
            documents = _normalize_documents(inputs.get("documents") or [])
            store_type = str(properties.get("storeType") or "memory")
            collection_name = str(properties.get("collectionName") or "default")
            vector_store = _DeterministicVectorStore()
            lc_documents = [
                LangChainDocument(page_content=document["content"], metadata=document["metadata"])
                for document in documents
            ]
            vector_store.add_documents(lc_documents)
            return {
                "vectorStore": {
                    "storeType": store_type,
                    "collectionName": collection_name,
                    "records": [
                        {
                            "id": document["id"],
                            "content": document["content"],
                            "metadata": document["metadata"],
                        }
                        for document in documents
                    ],
                }
            }

        if node_type == "langchain.similarity_search":
            query = str(inputs.get("query") or "")
            handle = inputs.get("vectorStore") or {}
            records = list(handle.get("records") or []) if isinstance(handle, dict) else []
            store = _DeterministicVectorStore()
            store.add_documents([
                LangChainDocument(page_content=str(record.get("content") or ""), metadata=record.get("metadata") or {})
                for record in records
            ])
            threshold = float(properties.get("scoreThreshold") or 0)
            matches = store.similarity_search(query, k=max(1, int(properties.get("k") or 4)))
            normalized = []
            query_tokens = {token for token in query.lower().split() if token}
            for document in matches:
                candidate_tokens = {token for token in document.page_content.lower().split() if token}
                score = 0.0 if not query_tokens else len(query_tokens & candidate_tokens) / len(query_tokens)
                if score >= threshold:
                    normalized.append({
                        "content": document.page_content,
                        "metadata": {**(document.metadata or {}), "score": score},
                    })
            return {"documents": normalized}

        if node_type == "langchain.context_formatter":
            documents = _normalize_documents(inputs.get("documents") or [])
            template = str(properties.get("template") or "[{index}] {content}")
            max_length = max(1, int(properties.get("maxLength") or 2000))
            rendered = [
                template
                .replace("{index}", str(index + 1))
                .replace("{content}", document["content"])
                .replace("{metadata}", json.dumps(document["metadata"], sort_keys=True))
                for index, document in enumerate(documents)
            ]
            return {"context": "\n\n".join(rendered)[:max_length]}

        if node_type == "langchain.summarization":
            documents = _normalize_documents(inputs.get("documents") or [])
            strategy = str(properties.get("strategy") or "stuff")
            model = str(inputs.get("model") or "summary-model")
            lc_documents = [
                LangChainDocument(page_content=document["content"], metadata=document["metadata"])
                for document in documents
            ]
            if load_summarize_chain is not None and documents:
                try:
                    chain = load_summarize_chain(_DeterministicLlm(model), chain_type=strategy)
                    summary = chain.run(lc_documents)
                except Exception:
                    summary = f"[{model}] {strategy} summary: {' '.join(document['content'] for document in documents)[:300]}"
            else:
                summary = f"[{model}] {strategy} summary: {' '.join(document['content'] for document in documents)[:300]}"
            return {"summary": summary}

        if node_type == "langchain.combine_summaries":
            summaries = [str(item) for item in (inputs.get("summaries") or []) if str(item).strip()]
            method = str(properties.get("method") or "concatenate")
            combined = " ".join(summaries) if method == "reduce" else "\n\n".join(summaries)
            return {"combinedSummary": combined}

        raise ValueError(f"Unsupported langchain node type: {node_type}")
