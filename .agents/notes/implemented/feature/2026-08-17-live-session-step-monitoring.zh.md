# Agent Note: 暴露实时 step 状态以支持卡死监控

Status: implemented

[English](2026-08-17-live-session-step-monitoring.md) | 中文

## 问题

sessionStats projection 从一开始就把其数字所依据的进行中步边界纳入折叠——打开的 step（turn、step、startTime、firstTokenTime）与未返回的工具调用（callId 到 dispatch 时间）——但其 view 只返回已完成的合计，因此持久化的 projection cache 不带任何这类实时状态。观察 `session_projcache.json` 的运维人员能看到会话记录了轮与步，却无法得知某个 step 当前是否打开、已运行多久、哪些工具调用尚未返回。卡死检测因此没有数据来源：循环之外没有任何机制能区分健康的长时间 LLM 流与卡住的 step。

现有保护各自停留在自己的边界：`streamIdleTimeoutMs` 在迭代器未返回期间约束传输层，工具 timeout 策略只约束单个工具调用。没有机制观察整个打开的 step。

## 决策

sessionStats view 现在暴露它本就在折叠的实时状态：`openStep`（空闲时为 null）与 `pendingCalls`（无未返回调用时为空）。projection cache 持久化的是单元的 view，而每个载体都经 view 读取该状态，因此两个字段都进入 `session_projcache.json` 与 projection 变更流。`stateVersion` 升到 2，因为存储的 row 形状发生了变化：view 变更前写入的 row 缺少这两个新字段，版本不匹配会在冷读时丢弃它们，而不是提供 schema 不再接纳的 row。

插件新增一个可选配置 `stallThresholdMs`。设为正值时，进程内的每个打开 step 计时器在 step 超过阈值后记录一条警告，标注会话、turn、step、已运行毫秒数与阈值。step 关闭或 turn 结束时清除计时器，新的 `step/start` 会替换上一个 step 的计时器。省略或为 0 则关闭检测，与随附装配保持一致——它们挂载本插件时不带任何配置。schemastery schema 将该值校验为非负整数，因此畸形阈值会在加载时失败，而不是静默关闭检测。

监控器只做观察：它发出警告，绝不取消工作、修改会话数据或改变调度。由运维人员、模型或外部监控使用 projection cache 已暴露的同一份数据决定是否干预。

## 备选方案

**在 agent loop 中加入 step 截止时间。** 拒绝，因为 loop 已有自身的取消语义，自动 step 超时可能丢弃合法的长时间模型流；传输层 idle watchdog 已经约束了病态情形。

**发出类型化事件而非日志行。** 延后，因为 projection cache 已是实时状态的持久载体，且当前没有消费方需要独立的卡死事件流；日志行使首个迭代保持单一用途。

## 影响

现有部署在 sessionStats view 中看到的是附加字段；它们读取的内容不会破坏，已缓存的旧行因版本不匹配而被丢弃，并在下一次冷读时从日志重新计算。可选配置不改变任何随附装配。每个打开的 step 在计时器生命周期内最多发出一次警告——超过阈值后仍保持打开的 step 不会再次警告，直到后续 step 开始。
