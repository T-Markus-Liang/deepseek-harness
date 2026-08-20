---
Date: 2026-08-20
Session id: 2026-08-20_1610_fix-image-model-selection
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Allow Web model selection when a session contains images
Status: completed
Branch: current worktree
---

English | [中文](2026-08-20_1610_fix-image-model-selection.zh.md)

## User request

修复 Web 端因会话历史含图片而无法选择纯文本模型的问题。保留实际发送阶段对不支持图片模型的明确错误，并确保新前端 bundle 被 Web 服务加载。

## Work done

- 核对 `packages/host/apiproxy/src/api-proxy.ts`：已移除 `session.selectModel` 对历史/待发送图片的阻断；`session.prompt` 仍在持久化前拒绝发给不支持图片的模型。
- 更新模型选择客户端测试，覆盖含图片会话切换到文本模型成功。
- 更新 `llm-pi-ai` 中英文 README 的旧行为说明。
- 聚焦测试：模型选择、Host 模型 API、pi-ai 与 DeepSeek adapter 共 153 tests passed；修改后模型选择与 Host 共 15 tests passed。

## Current state

代码改动尚未完成构建和 Web 服务重启。工作树包含此前用户请求的会话生命周期等未提交改动，必须保留。

## Resume instructions

运行 `pnpm run build`，重启当前 `dsh web` 进程，验证 `http://127.0.0.1:3080/` 返回并加载新 bundle；再运行相关类型检查或 `pnpm run doc-sync`，最后将本日志移到 `completed/` 并同步索引与全局 registry。

## Open questions

若用户仍看到旧错误，需检查浏览器缓存或服务是否实际使用了旧 `apps/cli/lib` / `apps/web/dist` 构建产物。
