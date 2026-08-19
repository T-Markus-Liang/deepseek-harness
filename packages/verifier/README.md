# verifier/ — trajectory verification family

English | [中文](README.zh.md)

This family ranks complete agent trajectories and builds opt-in best-of-N workflows.

| Package | Role | Context |
|---|---|---|
| [`verifier/`](verifier/README.md) | Service Definition for trajectory selection | `ctx.verifier` |
| [`verifier-python/`](verifier-python/README.md) | Pinned `llm-verifier==0.2.0` Python provider | registers `ctx.verifier` |
| [`tool-verify-candidates/`](tool-verify-candidates/README.md) | Ranks existing durable Sessions | registers `verify_candidates` |
| [`tool-best-of-n/`](tool-best-of-n/README.md) | Generates candidates in isolated Git worktrees and promotes the winner | registers `best_of_n` |

No package in this family is part of a default bundle. Deployments opt in to the provider and the consumers they need.
