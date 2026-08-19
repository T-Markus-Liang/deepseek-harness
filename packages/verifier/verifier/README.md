# @deepseek-ai/dsh-verifier

English | [中文](README.zh.md)

The verifier Service Definition exposes `ctx.verifier.select(request)`. A request contains one problem, complete candidate trajectory strings, named criteria, an explicit model, tournament settings, a concurrency limit, and optional cancellation. The result identifies the winning input index, scores and a full ranking in input coordinates, comparison count, normalized criteria ids, and token usage.

Providers validate every result crossing their external boundary. Consumers retain ownership of candidate generation and Session projection; this seam never acts as an LLM adapter and never mutates a workspace.

## Model Experience

### Consumer projection

#### What the model sees

Nothing directly. Model-facing verifier Consumers own tool schemas and result rendering; `ctx.verifier.select()` returns structured selection data only to those Consumers.

#### Token effect

No direct token cost. A Consumer decides which result fields enter a model request.

#### KV Cache effect

No direct invalidation. Consumer tool visibility and retained results own cache effects.

## Known Limitations and Deferred Work

- The first API exposes selection only; pairwise comparison and progress tracking remain deferred.
- The seam does not standardize image inputs or verifier cache storage.
