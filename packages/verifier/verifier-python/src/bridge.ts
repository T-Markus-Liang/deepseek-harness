/** Python source embedded in the published provider bundle. @module @deepseek-ai/dsh-verifier-python/bridge */

/** Exact upstream Python distribution requirement owned by this provider. */
export const LLM_VERIFIER_REQUIREMENT = 'llm-verifier==0.2.0'

/** One-request Python bridge written into the operation-private directory. */
export const PYTHON_BRIDGE = String.raw`#!/usr/bin/env python3
import contextlib
import importlib.metadata
import io
import json
import sys

PROTOCOL_VERSION = 1
PACKAGE_VERSION = "0.2.0"

def response(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")

def main():
    try:
        request = json.load(sys.stdin)
        installed = importlib.metadata.version("llm-verifier")
        if installed != PACKAGE_VERSION:
            raise RuntimeError(f"llm-verifier version mismatch: expected {PACKAGE_VERSION}, got {installed}")
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
            import llm_verifier
            llm_verifier.USAGE.reset()
            result = llm_verifier.select(
                problem=request["problem"],
                candidates=request["candidates"],
                criteria={item["name"]: item["description"] for item in request["criteria"]},
                model=request["model"],
                n_evaluations=request["nEvaluations"],
                pivots=request["pivots"],
                seed=request["seed"],
                max_workers=request["maxConcurrency"],
                cache=None,
                progress=False,
                on_error="raise",
            )
            usage = llm_verifier.token_usage()
        response({
            "protocolVersion": PROTOCOL_VERSION,
            "packageVersion": PACKAGE_VERSION,
            "ok": True,
            "result": {
                "index": result.index,
                "scores": result.scores,
                "ranking": result.ranking,
                "comparisons": result.n_comparisons,
                "criteria": result.criteria,
                "usage": {
                    "calls": usage["calls"],
                    "inputTokens": usage["input_tokens"],
                    "cachedInputTokens": usage["cached_input_tokens"],
                    "uncachedInputTokens": usage["uncached_input_tokens"],
                    "outputTokens": usage["output_tokens"],
                    "reasoningTokens": usage["reasoning_tokens"],
                },
            },
        })
    except Exception as error:
        response({
            "protocolVersion": PROTOCOL_VERSION,
            "packageVersion": PACKAGE_VERSION,
            "ok": False,
            "error": {"type": type(error).__name__, "message": str(error)},
        })

if __name__ == "__main__":
    main()
`
