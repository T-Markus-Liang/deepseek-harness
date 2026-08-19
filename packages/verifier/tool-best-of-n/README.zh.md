# @deepseek-ai/dsh-tool-best-of-n

[English](README.md) | 中文

可选启用的 `best_of_n` 工具是一条固定编码工作流：确认父 Git worktree 干净，在同一个 HEAD 创建 N 个 detached worktree，在每个 worktree 启动一个本地 one-shot subagent，对完整 Session surface 排名，提取胜者 Git patch，再次检查父工作区，只应用胜者 patch，最后移除所有候选 worktree。

所选 subagent provider 必须声明 `workspaceCwd`；同进程 spawn 和 fork provider 支持此能力。不支持的 provider 会在创建 worktree 前失败。worktree 创建完成后候选并发启动，但启动定态、结果收集和 dispose 都会完整等待。如果胜者 patch 提取或提升失败，胜者 worktree 会被保留，错误中包含恢复路径。父工作区发生变化时绝不会覆盖。

## 模型体验

### 工具 schema、子请求与结果

#### 模型看到的内容

生成的 [`best_of_n` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-best-of-n)接受一个目标、准则、候选数量和可选 verifier seed。每个候选看到目标以及固定的隔离与验证指导。父级收到候选 Session id、胜者与排名、分数、比较次数、提升状态和 verifier 用量；provider route、模型、并发和限制仍由部署拥有。

#### Token 影响

每个候选支付独立子上下文成本，verifier 为成对轨迹比较付费。父级只保留一个有界结构化结果，不保留子 transcript。

#### KV Cache 影响

候选上下文和 verifier 请求使用独立 cache。父级工具结果追加在可复用请求前缀之后。

## 已知限制与延期工作

- 父工作区必须是干净且已检出 `HEAD` 的 Git worktree；detached worktree 无法安全复现脏状态，因此会直接拒绝。
- worktree 隔离文件修改，但不是安全沙箱；Git 元数据和外部资源仍按部署策略共享。
- 胜者提升会应用未暂存 patch，不会创建 commit。
- 通过 `agent/turn-stopping` 提供在线 verifier 进度，等三阶段集成稳定后再实现。
