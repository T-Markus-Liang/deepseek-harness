# @deepseek-ai/dsh-tool-verify-candidates

[English](README.md) | 中文

可选启用的 `verify_candidates` 工具对调用 agent 工作区内已有的持久化 Session 排名。模型提供共享问题、互不重复的 Session id、准则和可选确定性 seed。部署配置负责模型、评估次数、pivot、verifier 并发、候选数量和轨迹大小上限。

工具要求调用方绑定 agent 且具有工作区 cwd。它对每个 id 调用 `sessionPersistence.inspect()`，使用同一个模型侧错误拒绝缺失或跨工作区 header，并通过规范的 `Session.deriveMessages()` 规则重建当前模型可见 surface。仅用于日志的 chunk、生命周期记录和被替换的 surface 节点不会进入 verifier 轨迹。超大轨迹会失败，不会静默截断。结果会把分数和排名映射回原始 Session id。

## 模型体验

### 工具 schema 与结果

#### 模型看到的内容

生成的 [`verify_candidates` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-verify-candidates)接受共享问题、Session id、准则和可选 seed。结果包含 `winnerSessionId`、完整 Session-id 排名、分数、比较次数和 verifier Token 用量。

#### Token 影响

Schema 为请求增加少量固定成本。保留结果随候选数量增长，完整候选轨迹留在父级对话之外。

#### KV Cache 影响

只要组合不变，工具可见性就保持前缀稳定。结果追加在可复用父级前缀之后。

## 已知限制与延期工作

- 每个候选必须已对配置的 Session persistence provider 可见，并携带与调用 agent 完全相同的工作区 cwd。
- 任务描述和准则是显式工具输入，不会从候选日志推断。
- 首版集成不投影图片附件。
