# 评估 LLM-as-a-Verifier 集成

[English](2026-08-18_1932_assess-llm-verifier-integration.md) | 中文

- 日期：2026-08-18 19:32 CST
- Session id：`01a01499-e19a-7441-9f32-ef8932f3e3f7`
- 项目：DeepSeek Harness
- 工作区：`/Users/markus/deepseek-harness`
- 任务：评估如何将 `llm-as-a-verifier/llm-as-a-verifier` 集成到本地 Harness 项目。
- 状态：已完成
- 分支：`master`，跟踪 `personal/master`

## 用户请求摘要

检查外部 LLM-as-a-Verifier 仓库，并建议如何集成到本地 DeepSeek Harness 项目。

## 已完成工作

- 解析公开上游仓库，使用 GitHub 元数据和仅包含源码的 sparse clone 检查 `main` 的 commit `115de305`。
- 阅读上游 README、`pyproject.toml`、changelog、公开 Python API、logprob 评分实现、进度跟踪器、提示词解析器、锦标赛和轨迹 loader。
- 对比上游要求与 Harness 的 LLM 流、agent 生命周期、持久化 Session 日志、子进程、workflow、subagent 和凭据能力。
- 尝试原生 explorer 和有界外部 worker 评审。原生 explorer 因服务高负载失败；两次外部 worker 评审没有产出可接受的结构化结果且未修改文件，因此主任务根据直接检查的证据完成有界评审。

## 决策

- 不把 LLM-as-a-Verifier 作为普通 Harness LLM 适配器：它消费已完成的候选轨迹，并要求当前提供方无关 `StreamChunk` 未暴露的 token-level top-logprobs。
- 新增可选 verifier 能力；首个提供方通过 `ctx.subprocess` 和显式 JSON 协议调用固定版本的 Python 包。
- 将候选生成与评分分开。现有 subagent/workflow 能力负责生成候选 Session，verifier 消费方负责格式化和排名。
- 在明确支持 Python runtime 获取和打包前，不把提供方挂载到 base bundle。
- 首个消费方对已有候选 Session id 排名；只有定义隔离候选工作区和胜者提升后，才增加自动 best-of-N 编排。
- Verifier 失败默认作为硬错误，而不是采用上游的中性平局 fallback。

## 当前状态

- 上游采用 MIT 许可证，要求 Python 3.9+，包 `llm-verifier` 版本为 `0.2.0`，依赖 `google-genai`、`openai` 和 `tqdm`。
- 公开操作包括 `select`、`compare`、`track` 和 `ProgressTracker`；评分依赖 top-20 token logprobs，可能发出许多并发请求。
- Harness Session 事件包含构建确定性文本轨迹所需的信息，但当前没有 Host 侧 verifier 轨迹格式化器。
- 产品代码未变。本地项目只有 Codex Session 日志变更。
- 建议的包拆分为 verifier Service Definition、Python `llm-verifier` 子进程提供方、确定性 Harness Session 轨迹格式化器，以及面向模型的排名消费方。在线 turn-stopping 反馈延期。
- 主要风险是现有 LLM seam 缺少 logprobs、Python 分发/runtime 获取、上游 `.env` 加载与默认 500 worker、非原子 JSON cache、上游缺少测试、成本放大，以及候选文件系统隔离/提升。

## 恢复说明

1. 阅读本日志、仍存在时读取记录的临时 clone 中的上游源码，并查看本任务最终建议。
2. 确认首个用户工作流：手动候选排名、自动 best-of-N subagent，或在线进度反馈。
3. 如果获准实现，添加包前先制定限定范围的计划，并阅读 `docs/defensive-patterns.md` 的子进程生命周期要求。
4. 从固定版本的 Python bridge spike 和 fake bridge 测试开始，不要先扩展通用 LLM 流协议。

## 待确认问题

- 首个集成应为用户/模型调用的排名工具，还是自动 best-of-N workflow。
- 本地开发是否可以要求专用 Python 虚拟环境，或者分发必须能在打包的单文件运行时中工作。
