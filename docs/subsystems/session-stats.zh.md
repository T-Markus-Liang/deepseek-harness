# Session Stats

[English](session-stats.md) | 中文

`sessionStats` 投影单元（[@deepseek-ai/dsh-session-stats](../../packages/session/session-stats)）——[session-projection seam](session-projection.md) 的一个领域贡献者——从持久会话日志折叠出全日志会话数字，并通过 registry 快照、变更流与每一个 projection 载体对外提供。全日志数字不受分页与压缩影响；单元只拥有折叠，交付是 seam 的职责。插件从不触碰模型请求；参考消费者是 Web 聊天统计条，其窗口折叠以相同字段名充当无单元时的回退。

来源：[`packages/session/session-stats/src/types.ts`](../../packages/session/session-stats/src/types.ts)

## 投影值

`SessionStatsProjection` 是该单元的 wire 值：轮/步计数与 LLM、工具、首 token、解码墙钟时间，加上为外部监控暴露的实时打开的 step 与进行中的工具调用。

```ts type-equiv
/**
 * Whole-log conversation figures, independent of how much history a client
 * has paged in. Counts and wall times all fold from the complete durable log;
 * every field is 0 until its first contributing event lands. Field names
 * mirror the client window fold so an assembly without this unit can fall
 * back to it wholesale.
 */
interface SessionStatsProjection {
  /** Distinct turns carrying at least one closed step (`step/end`); rejected or empty turns are uncounted. */
  turns: number
  /** Closed steps (`step/end` events) — completed, failed, and cancelled steps alike. */
  steps: number
  /** Summed model wall time (`step/start` → `assistant/message`) over steps that assembled a message. */
  llmMs: number
  /** Summed tool wall time over `tool/call` → `tool/result` pairs matched by callId. */
  toolMs: number
  /** Summed first-token latency (`step/start` → first non-empty delta chunk) over `ttftSteps`. */
  ttftMs: number
  /** Steps carrying a recorded first token. */
  ttftSteps: number
  /** Summed decode wall time (first token → `assistant/message`) over steps that also report output tokens. */
  decodeMs: number
  /** Summed provider output tokens over the same decode-timed steps. */
  decodeTokens: number
  /**
   * Current open step, null when idle. Cleared when the step closes or its
   * message assembles. Exposed for live monitoring (e.g. `session_projcache.json`).
   */
  openStep: { turn: number; step: number; startTime: number; firstTokenTime: number | null } | null
  /**
   * Dispatch times of tool calls whose result has not yet landed, keyed by
   * callId. Pruned when the result lands and dropped wholesale at `turn/end`.
   * Exposed for live monitoring.
   */
  pendingCalls: Record<string, number>
}
```

每个数字字段在首个贡献事件之前均为 0；无进行中工作时 `openStep` 保持 `null`、`pendingCalls` 保持为空。已装配的 registry 恒提供该键，客户端读取值本身，而非键的存在性。

## 折叠

- `steps` 统计 `step/end` 事件——loop 对每个进入的步在 `finally` 中恰好追加一条，因此完成、失败、取消、max-tokens 的步全部计入。
- `turns` 统计含至少一个已关闭步的不同 turn；被拒绝或空轮不计。
- `llmMs` 按步累加 `step/start` → `assistant/message`（组装出消息的步；步内重试的等待计入模型时间）。
- `ttftMs`/`ttftSteps` 累加并统计 `step/start` → 首个非空 delta chunk；首次尝试的边界在步内 `llm/retry` 后保留。
- `decodeMs`/`decodeTokens` 累加首 token → 已组装消息的时长与提供方上报的输出 token，仅统计两者兼备的步。
- `toolMs` 按 callId 配对累加 `tool/call` → `tool/result`；未解决的调用在 `turn/end` 时丢弃（结果总在其轮内落地）。
- `openStep` — 当前打开的 step（空闲时为 null）：其 `turn`、`step`、`startTime` 与 `firstTokenTime`（首个 delta 分块前为 null）。
- `pendingCalls` — 尚未收到结果的工具调用分发时间，按 callId 索引；在 `turn/end` 时整体清空。

## 实时监控

`openStep` 与 `pendingCalls` 让运维人员能够区分长时间但健康的流与卡住的 step，可从 projection cache（`session_projcache.json`）或 `session/projection` 变更流读取。单元把它们作为普通字段暴露；恢复决策由运维人员或外部监控负责。

## 卡死检测

可选的 `stallThresholdMs` 配置在 `step/start` 时启动每个会话的计时器；超过阈值仍未关闭的 step 会记录一条警告，标明会话、turn、step、已运行时间与阈值。监控器仅做观察——绝不取消 step 或改变调度。

类型：[SessionEvent](session.md) · [ProjectionDefinition](session-projection.md) · [SessionProjectionMap](session-projection.md)
