# Agent Note：pinned bridge 背后的 DeepSeek 兼容 verifier 后端

Status: implemented

[English](2026-08-19-verifier-deepseek-compatible-backends.md) | 中文

## Problem

`llm-verifier` 依据其 verifier backend 返回的 token 级 top-20 logprobs 为候选评分。聚合/中转端点通常拒绝 `logprobs` 参数（SenseNova、Kimi、方舟 Coding Plan），或接受参数但不返回数据（cmd-code），因此它们都无法驱动选择。本机 `morecode` shim 把请求透传给一个 DeepSeek 语义上游（1314mc.net），其 `deepseek-v4-flash` 模型确实返回真实的逐 token logprobs，但 shim 地址不含 `api.deepseek.com`，上游因此永远不会给客户端打 DeepSeek 标。评分于是进入 vLLM/SGLang 专用 prefill 分支（`_score_tags_by_prefill`），DeepSeek 兼容服务器无法满足该分支，每次选择都静默退化为 0.5 平局且用量记为零。

## Decision

为 `dsh-verifier-python` 增加三个面向部署的 `Config` 字段，扩展 verifier capability 家族决策（[llm-verifier-best-of-n](2026-08-18-llm-verifier-best-of-n.md)）：`deepseekCompatible`（默认 false）、`maxTokens`（默认 8192）与 `effort`（默认 `off`）。当 `deepseekCompatible` 为 true 时，provider 向 bridge 进程环境转发 `LLM_VERIFIER_DEEPSEEK_COMPATIBLE=1`、`DEEPSEEK_MAX_TOKENS` 与 `DEEPSEEK_EFFORT`。内嵌 bridge 随后通过替换 `fine_grained_reward.create_openai_client`，给为配置端点构建的每个客户端打上 `_llm_verifier_deepseek` 标，使评分走 DeepSeek 调用路径——模型自行输出评分标签与 token 级 logprobs。官方 DeepSeek API 无需这些：其 base URL 已触发上游打标，默认 false 也保持旧行为不变。

DeepSeek 家族推理模型在作答前会消耗输出预算，因此默认组合是受限的 `DEEPSEEK_MAX_TOKENS`（8192）加 `DEEPSEEK_EFFORT=off`；2048 的预算会被推理完全耗尽并报错，而上游 32768 的默认值会使调用挂起。凭据引用必须指向 OpenAI 兼容变量：配置 OpenAI base URL 时上游读取 `OPENAI_API_KEY`（回退到 `DEEPSEEK_API_KEY`），因此像 `morecode` shim 这样的部署配置 `credentialRef: MORECODE_API_KEY` 与 `credentialEnv: OPENAI_API_KEY`。

## Testing

Fake bridge 测试断言三个环境变量仅在配置 `deepseekCompatible` 时转发（`credentialEnv` 指向 `OPENAI_API_KEY`），并断言生产 bridge 同时内嵌 `LLM_VERIFIER_DEEPSEEK_COMPATIBLE` 开关与 `_llm_verifier_deepseek` 标。用导出后的 bridge 对 `morecode` shim 以 `deepseek-v4-flash` 做真实运行：在三个候选的反转字符串问题上选出正确候选，分数有效分层，用量被记录，且包含非零缓存 token。

## Alternatives considered

- **给上游打补丁，把任意 base URL 识别为 DeepSeek** —— 拒绝，因为上游发布节奏不受 harness 控制；内嵌 bridge 让 pinned 版本保持封闭自洽，部署仍可覆盖 `bridgePath`。
- **用重采样近似 logprobs** —— 拒绝，因为频率估计不是模型的真实分布，会使 verifier 赖以成立的分数期望失效。
- **本地运行 vLLM 风格服务器** —— 拒绝，属于部署自有事项，且当前环境没有 GPU 主机。

## Consequences

- DeepSeek 语义的中转端点（如本环境的 `morecode` shim）只需三个配置值即可开箱即用。
- 官方 DeepSeek 部署不受影响，因为默认仍是 false。
- provider 契约现在区分 OpenAI 兼容中转与 DeepSeek 兼容中转；错误打开（把非 DeepSeek 端点标记为兼容）会以 DeepSeek 调用路径的 bridge 错误形式暴露。

## Known limitations and deferred work

- 打标作用于 bridge 进程内构建的每个客户端，因此一个 provider 实例无法同时混合 OpenAI 语义端点与 DeepSeek 语义端点。
- `DEEPSEEK_EFFORT` 与 `DEEPSEEK_MAX_TOKENS` 只影响 DeepSeek 调用路径；其他后端忽略它们。
- 在本端点上调高 `effort`（连同输出预算）的推理质量权衡尚未实测。