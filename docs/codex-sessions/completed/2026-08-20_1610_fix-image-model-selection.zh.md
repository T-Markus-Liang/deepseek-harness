---
Date: 2026-08-20
Session id: 2026-08-20_1610_fix-image-model-selection
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: 修复含图片会话的 Web 模型选择
Status: completed
Branch: current worktree
---

[English](2026-08-20_1610_fix-image-model-selection.md) | 中文

## 用户请求

修复 Web 端因会话历史含图片而无法选择纯文本模型的问题。保留实际发送阶段对不支持图片模型的明确错误，并确保新前端 bundle 被 Web 服务加载。

## 已完成工作

- 核对 `packages/host/apiproxy/src/api-proxy.ts`：已移除 `session.selectModel` 对历史或待发送图片的阻断；`session.prompt` 仍在持久化前拒绝发给不支持图片的模型。
- 更新模型选择客户端测试，覆盖含图片会话切换到文本模型成功。
- 更新 `llm-pi-ai` 中英文 README 的旧行为说明。
- 聚焦测试通过；全量构建成功并重启 Web 服务。

## 当前状态

服务已在 `127.0.0.1:3080` 运行。工作树包含此前用户请求的会话生命周期等未提交改动，必须保留。

## 恢复说明

如需继续，检查当前进程、运行相关类型检查和文档门禁，并将本日志移到 `completed/` 后同步索引与全局 registry。

## 未解决问题

若用户仍看到旧错误，检查浏览器缓存或服务是否实际使用了旧构建产物。
