# verifier/ — 轨迹验证能力族

[English](README.md) | 中文

本能力族对完整 Agent 轨迹进行排名，并提供可选启用的 best-of-N 工作流。

| 包 | 角色 | Context |
|---|---|---|
| [`verifier/`](verifier/README.md) | 轨迹选择的 Service Definition | `ctx.verifier` |
| [`verifier-python/`](verifier-python/README.md) | 固定 `llm-verifier==0.2.0` 的 Python provider | 注册 `ctx.verifier` |
| [`tool-verify-candidates/`](tool-verify-candidates/README.md) | 对已有持久化 Session 排名 | 注册 `verify_candidates` |
| [`tool-best-of-n/`](tool-best-of-n/README.md) | 在隔离 Git worktree 中生成候选并提升胜者 | 注册 `best_of_n` |

本能力族不进入任何默认 bundle。部署必须显式选择 provider 和所需 Consumer。
