# 实现 LLM-as-a-Verifier 集成

[English](2026-08-18_1949_implement-llm-verifier.md) | 中文

- 日期：2026-08-18 19:49 CST
- Session id：`01a01499-e19a-7441-9f32-ef8932f3e3f7`
- 项目：DeepSeek Harness
- 工作区：`/Users/markus/deepseek-harness`
- 任务：实现已批准的分阶段 LLM-as-a-Verifier 集成。
- 状态：已完成
- 分支：`master`，跟踪 `personal/master`

## 用户请求摘要

实现此前建议的三个阶段：固定版本的 Python JSON bridge，并以 fake bridge 覆盖 selection、取消、凭据和输出限制；实现对已有候选 Session 排名的 `verify_candidates` 工具；实现带隔离候选工作区的自动 best-of-N workflow。在这些阶段完成前，延期通过 `agent/turn-stopping` 注入在线进度。

## 延续自

- `/Users/markus/deepseek-harness/docs/codex-sessions/completed/2026-08-18_1932_assess-llm-verifier-integration.md`

## 已完成工作

- 确认请求的三个实现阶段，以及明确延期在线 turn-stopping 反馈。
- 加载仓库对子进程/并发变更、包、文档、Agent Note 和文案的说明。
- 运行 `deepseek-worker --json doctor`；外部 worker runtime 健康。
- 新增 `verifier` Service Definition，以及固定为 `llm-verifier==0.2.0`、对应上游提交 `115de305f23ed89bc42e86e010853c40059f3f7d` 的 Python provider。
- 实现内嵌且有界的 JSON bridge，包括显式凭据解析、清除环境中形似凭据的变量、每次操作使用私有目录、严格校验协议与结果、独立限制 stdout/stderr 字节数，以及取消完整进程树。
- 新增 fake bridge 子进程测试，覆盖 selection、取消、凭据缺失与转发、stdout/stderr 超限，以及畸形或版本不匹配的结果。
- 新增 `verify_candidates`：从已授权的持久化 Session 重建完整模型可见轨迹，对缺失或跨工作区候选返回统一拒绝，超限时直接失败而不截断，并按 Session id 返回 verifier 排名。
- 新增 `best_of_n`：要求父 Git worktree 干净，在同一 HEAD 创建 detached worktree，让一次性 subagent 使用隔离 workspace cwd，验证完整本地 Session 轨迹，并在重新检查父 HEAD 与状态后只提升胜者的 binary patch。
- 为 subagent capability 与进程内 provider 增加显式绝对路径 `workspaceCwd` 请求，包括不支持该能力的 provider 拒绝，以及子 Session cwd 传播。
- 新增包组合、生成目录与图、中英文子系统/包文档、无密钥 assembled snapshot，以及 Agent Note `.agents/notes/implemented/feature/2026-08-18-llm-verifier-best-of-n.md`。
- 验证 `packages/core/agent/src/runtime-types.ts` 与 `agent/turn-stopping` 保持不变。
- 委派的外部 worker 超时，并错误地把并发产生的文档改动归因于自己；未采用其结果，也未自动重跑。
- 验证结果：
  - `pnpm exec vitest run packages/verifier packages/subagent/subagent/tests/workspace-cwd.spec.ts`：6 个文件、18 项测试通过。
  - `pnpm exec tsc -b packages/verifier/verifier packages/verifier/verifier-python packages/verifier/tool-verify-candidates packages/verifier/tool-best-of-n`：通过。
  - `pnpm exec vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/verifier.snapshot.ts`：1 项 snapshot 测试通过。
  - `pnpm run doc-sync`：28 个门禁通过。
  - `pnpm run verify-translation-pairing`：966 对文档通过。
  - 对 verifier 与改动过的 subagent 文件运行聚焦 `pnpm exec oxlint`：通过。
  - `git diff --check`：通过。
  - `pnpm run lint`：verifier 改动通过；全仓命令仅被既有的 `packages/host/apiproxy/src/fetch/handler.ts:188` `no-unnecessary-type-parameters` 问题阻塞。

## 决策

- 将候选生成与 verifier 评分分开。
- 在显式有界 JSON 协议之后使用固定版本的 Python 子进程。
- 在增加自动候选生成前，先对已有持久化 Session 排名。
- 将调用方 Session cwd 作为 `verify_candidates` 的授权范围，不把任意持久化 Session 发送给外部 verifier。
- 当 patch 提取、父状态复核或 patch 应用失败时保留胜者 detached worktree，以便人工恢复。
- 清理失败不能覆盖更早的提升错误；保留主错误并同时报告两者。
- 这些阶段不修改 `packages/core/agent/src/runtime-types.ts`。

## 当前状态

- 请求的三个阶段都已实现，并有聚焦测试、无密钥 assembled snapshot、生成文档和类型检查覆盖。
- 通过 `agent/turn-stopping` 提供在线进度反馈仍按计划延期。
- 唯一的全仓 lint 失败是 `packages/host/apiproxy/src/fetch/handler.ts:188` 中与本任务无关的既有问题。

## 恢复说明

1. 阅读本日志、verifier 子系统文档和 Agent Note。
2. 检查 `packages/verifier/` 以及 `packages/subagent/` 下新增的 `workspaceCwd` 支持。
3. 如果需要全仓 lint 完全通过，单独修复无关的 Host lint 问题。
4. 将在线 `agent/turn-stopping` 进度作为后续独立变更，并单独设计和增加 snapshot 覆盖。

## 待确认问题

- 请求的三个阶段没有待确认问题。
