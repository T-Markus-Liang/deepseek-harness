# Agent Note：固定版本轨迹 verifier 与隔离 best-of-N

状态：已实现

[English](2026-08-18-llm-verifier-best-of-n.md) | 中文

## 问题

Harness 已能生成子 Session 和运行通用 workflow，但没有独立 evaluator 对完整候选轨迹排名。把 `llm-as-a-verifier` 接成 `LlmAdapter` 并不正确：selection 同时消费多条完整轨迹，并依赖 verifier backend 自身的 token-level log probabilities。若从模型工具直接调用 Python API，也会把进程安全、凭据、Session 投影和候选编排混进一个插件。

自动 best-of-N 还有额外要求。能修改文件的候选不能在同一工作树中竞争，而 detached Git worktree 从已提交 `HEAD` 开始，不能复现任意脏本地状态。因此胜者提升必须有明确的父工作区干净前置条件，并在应用 patch 前再次检查。

## 决策

新增包含四个包的 verifier 能力族。`dsh-verifier` 定义 `ctx.verifier.select()`；`dsh-verifier-python` 通过每个子进程一个带版本 JSON 请求实现它；`dsh-tool-verify-candidates` 投影已有持久化 Session 并排名；`dsh-tool-best-of-n` 是建立在 subagent、Git worktree 和 verifier 之上的固定生成、评估与提升 Consumer。

Python provider 通过发布包版本 `llm-verifier==0.2.0` 固定上游提交 `115de305f23ed89bc42e86e010853c40059f3f7d`。导出的 `LLM_VERIFIER_REQUIREMENT` 与内嵌 bridge 的 `PACKAGE_VERSION` 都要求该精确版本。每次操作使用私有 cwd、有界 stdout/stderr、显式凭据引用、保守并发、`on_error="raise"`、无 cache 文件和无进度流。子进程基础环境剥离 ambient 凭据；私有 cwd 不含项目 `.env`，因此上游 dotenv 发现不能获取项目秘密。取消会等待完整子进程树退出。

`verify_candidates` 接受 Session id 而不是原始轨迹。它要求调用方绑定 agent，并且只接受所检查 Session header 的 cwd 与调用方工作区完全一致的候选；缺失和跨工作区 id 会在 verifier 调度前以相同的模型侧错误失败。它通过 `Session.deriveMessages()` 重建规范的当前消息 surface。仅日志事件和被替换的 surface 节点不会进入轨迹。超过配置上限的轨迹会失败而不是截断，verifier 索引再映射回调用方稳定的 Session-id 顺序。

为支持自动生成，one-shot `SubagentStartRequest` 新增可选 `workspaceCwd` 能力。Service 只接受绝对路径，并拒绝未声明支持的 provider。同进程 spawn 和 fork provider 把 override 写入子 Session header；普通委派不暴露模型路径参数，进程外 provider 保留部署拥有的 cwd 行为。

`best_of_n` 要求父 Git 工作区干净并记录其 `HEAD`。它顺序创建 detached worktree，仅在全部 worktree 存在后并发启动候选，等待每个启动与结果，对完整本地子 Session 排名，在胜者私有 worktree 内暂存文件，提取相对记录 base 的 binary patch，并再次检查父级 `HEAD` 和状态。只有通过检查后才应用 patch。正常完成会移除所有 worktree。Patch 提取或提升失败会保留胜者 worktree 并报告路径；部分创建只清理实际已经创建的路径。

所有 verifier 包保持 opt-in，不修改默认 bundle。通过 `agent/turn-stopping` 注入在线进度，要等 bridge、Session 排名和隔离生成获得运行证据后再实现。

## 测试

Fake bridge 测试会启动真实托管子进程，覆盖请求字段、单候选选择、显式凭据与 ambient-secret 剥离、取消至进程退出、缺失凭据、stdout 和 stderr 溢出、畸形响应、不一致排名和精确版本固定。工具测试证明调用方工作区授权、规范 Session-surface 投影与 Session-id 映射。真实临时 Git 仓库测试证明隔离 worktree 生成、仅胜者 patch 提升、清理和脏父工作区拒绝。Subagent 测试证明能力 gating 与绝对路径验证。真实 Loader 测试从 YAML 启动两个 Consumer；keyless assembled snapshot 同时暴露两个 schema，并通过确定性 verifier 为两条持久化 Session 排名。

## 考虑过的替代方案

- **把 selection 实现为 LLM adapter**：拒绝，因为 adapter 请求代表一次对话生成，不是使用 verifier 专用 logprob 语义比较多条完整轨迹。
- **通过工具传入原始轨迹**：拒绝，因为持久化 Session id 避免重复的模型控制 payload，并让 harness 拥有精确 transcript 重建。
- **为通用 workflow 脚本语言增加 verifier 和 isolation hook**：拒绝，因为固定编码 workflow 所需的 Git 干净检查、patch 提升和恢复规则不属于每个 workflow 脚本。
- **为每个候选复制当前目录**：拒绝，因为临时复制会丢失 Git 身份，使 patch 提取和清理语义不明确。Detached worktree 提供精确共享 base。
- **允许脏父工作区并在之后 merge**：拒绝，因为没有单独设计的 snapshot 协议时，无法以一个权威 base 复现或冲突检查未提交与未跟踪状态。

## 后果

- 完整轨迹评估成为可替换能力，而非 provider 专用工具代码。
- 可以在不重新生成候选的情况下对已有 Session 排名。
- 自动候选拥有独立文件修改，只有胜者 patch 能进入父工作区。
- Subagent seam 可以表达隔离 cwd，而不在普通模型委派中暴露它。
- 部署必须提供安装 `llm-verifier==0.2.0` 的 Python、配置一个凭据引用，并显式启用所需工具。

## 已知限制与延期工作

- Worktree 隔离修改而非权限：候选进程仍共享 Git 元数据，以及部署策略允许的外部访问。
- 胜者提升产生未提交的父工作区改动。创建 commit、three-way 冲突处理和脏父工作区 snapshot 属于其他策略。
- 首版 bridge 不暴露上游图片输入、comparison、progress tracking 或 cache 复用。
- 进程外 subagent provider 尚不接受每次运行的 workspace 路径。
- Verifier 阶段进度尚未通过 `agent/turn-stopping` 注入；该集成按计划延期。
