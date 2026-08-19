# @deepseek-ai/dsh-verifier-python

English | [中文](README.zh.md)

This provider runs one JSON request per Python process through bridge source embedded in the TypeScript bundle and written to a private operation directory. The exported `LLM_VERIFIER_REQUIREMENT` is `llm-verifier==0.2.0`, and the embedded bridge independently requires `PACKAGE_VERSION = "0.2.0"`; the bridge rejects any installed version mismatch before selection.

Each operation uses a private temporary cwd, so upstream `.env` discovery cannot read the candidate project. `dsh-subprocess` strips ambient credential-shaped variables, and the provider resolves exactly one configured credential reference per multi-candidate operation and forwards it under `credentialEnv`. `OPENAI_BASE_URL` is forwarded only when configured. Stdout and stderr have byte caps; stdout must be one versioned JSON value. Cancellation terminates the whole process tree and the provider waits for exit before settling.

Defaults are conservative: four concurrent verifier calls, `on_error="raise"`, no upstream score cache, and no progress output. Deployments install the exact requirement in the Python environment named by `pythonCommand`.

## Model Experience

### Provider result

#### What the model sees

Nothing directly. Verifier Consumers receive validated selection data from `ctx.verifier`; bridge failures become bounded Consumer errors rather than raw Python output.

#### Token effect

No direct conversation-token cost. Verifier API usage is returned as structured accounting for the Consumer to expose selectively.

#### KV Cache effect

No direct invalidation in the conversation model. The independent verifier backend manages its own prompt cache.

## Known Limitations and Deferred Work

- The pinned `llm-verifier` scoring consumes token-level top-20 logprobs from the verifier backend, so the backend (the DeepSeek official API, or any OpenAI-compatible server exposing logprobs) must return them. Aggregator and relay endpoints commonly reject the `logprobs` parameter or accept it without returning data; against such backends every selection degrades to the upstream neutral tie (equal candidate scores) and no usage is recorded. Validate the backend with a real `select()` before relying on rankings.
- Python environment provisioning is deployment-owned; this package does not run `pip`.
- One process is started per selection, so no warm client pool is retained.
- The provider forwards one credential reference and optional OpenAI-compatible base URL per instance.
