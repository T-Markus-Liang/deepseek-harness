# @deepseek-ai/dsh-tool-best-of-n

English | [中文](README.zh.md)

The opt-in `best_of_n` tool is a fixed coding workflow: verify a clean parent Git worktree, create N detached worktrees at the same HEAD, start one local one-shot subagent in each worktree, rank their complete Session surfaces, extract the winning Git patch, recheck the parent, apply only that patch, then remove every candidate worktree.

The selected subagent provider must advertise `workspaceCwd`; the in-process spawn and fork providers do. Unsupported providers fail before a worktree is created. Candidate starts run concurrently after worktrees are created, while startup settlement, result collection, and disposal are all awaited. If winner patch extraction or promotion fails, the winning worktree is preserved and its recovery path is included in the error. A changed parent is never overwritten.

## Model Experience

### Tool schema, child requests, and result

#### What the model sees

The generated [`best_of_n` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-best-of-n) accepts one objective, criteria, candidate count, and optional verifier seed. Each candidate sees the objective plus fixed isolation and verification guidance. The parent receives candidate Session ids, winner and ranking, scores, comparisons, promotion state, and verifier usage; provider routes, models, concurrency, and limits remain deployment-owned.

#### Token effect

Each candidate pays for an independent child context and the verifier pays for pairwise trajectory comparisons. The parent retains one bounded structured result rather than child transcripts.

#### KV Cache effect

Candidate contexts and verifier requests use independent caches. The parent tool result appends after its reusable request prefix.

## Known Limitations and Deferred Work

- The parent must be a clean Git worktree with a checked-out `HEAD`; dirty local state is rejected because detached worktrees cannot reproduce it safely.
- Worktrees isolate filesystem edits but are not a security sandbox; Git metadata and external resources remain shared according to deployment policy.
- Winner promotion applies an unstaged patch and does not create a commit.
- Live verifier progress through `agent/turn-stopping` is deferred until the three-stage integration is stable.
