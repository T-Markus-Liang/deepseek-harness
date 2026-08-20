# 准备隔离的 subscriptions Codex 试验

[English](2026-08-18_2116_prepare-subscriptions-codex-pilot.md) | 中文

- 日期：2026-08-18 21:16 CST
- Session id：`01a01499-e19a-7441-9f32-ef8932f3e3f7`
- 项目：DeepSeek Harness
- 工作区：`/Users/markus/deepseek-harness`
- 任务：为 `dsh-plugin-subscriptions@0.3.1` 准备可复现的隔离 Codex-only 试验。
- 状态：已完成
- 分支：`master`，跟踪 `personal/master`

## 用户请求摘要

保持 `V1ki/dsh-plugin-subscriptions` 为外部插件，不放入 `packages/` 或默认 bundle；固定 npm `0.3.1` 与 lockfile integrity；使用独立 `DSH_HOME` 和非主力订阅账号；只启用 Codex；同一凭据目录只允许一个 DSH 进程。在修复跨进程锁、刷新所有权、工具开关和认证测试前不扩大使用。

## 延续自

- `/Users/markus/deepseek-harness/docs/codex-sessions/completed/2026-08-18_1945_audit-subscriptions-plugin.md`

## 已完成工作

- 确认 `dsh-plugin-subscriptions@0.3.1` 的 npm 元数据，包括 registry integrity `sha512-nIAqkZnNNZIq0WaUixtV0fVHmmuRCngX6xCyLs5yOlZOTwMWgMo3HcQRXspkcPffu2PZf57XbuImARgCamSyfA==`。
- 阅读产品 profile 安装和外部 bundle 解析规则。
- 运行要求的外部 worker 健康检查；worker runtime 健康。
- 有界只读 worker 随后超时且未改文件；主线程完成最小 profile 工作，没有重放 worker 任务。
- 创建 `/Users/markus/.dsh-subscriptions-codex-pilot` 作为仅当前用户可访问的 Harness home，并通过产品 `dsh plugin` 命令把精确依赖 `dsh-plugin-subscriptions@0.3.1` 安装到它的 `web` profile。
- 确认隔离的 `pnpm-lock.yaml` 记录预期 registry integrity，且 `pnpm install --frozen-lockfile` 通过包管理器 supply-chain policy。
- 新增包含 `providers: [codex]` 的 profile 覆盖；最终组合配置只含该 provider 值。
- 新增 `/Users/markus/.dsh-subscriptions-codex-pilot/run-web.sh`，通过原子 owner 目录拒绝第二个由 wrapper 启动的 DSH 进程，并安全恢复 owner 已死亡的锁。
- 新增 `/Users/markus/.dsh-subscriptions-codex-pilot/verify-pilot.mjs`，解析 profile manifest、pnpm lockfile 和 Cordis patch，断言精确版本、integrity、bundle 列表和 Codex-only 运行时配置。
- 新增外部试验 README，记录冻结恢复命令、非主力账号规则、只通过 wrapper 启动的规则和扩大使用的阻塞项。
- 构建当前本地 Web bundle 需要的既有 `@deepseek-ai/dsh-client-ui-workbench` 产物，没有编辑它的源码。
- 通过持锁 wrapper 在 `http://127.0.0.1:3081` 启动隔离 Web profile。
- 在不启动 OAuth 的情况下打开本地设置 > 订阅页面；不存在 `auth.json`。
- 发现 0.3.1 不会按已配置 provider 过滤设置卡片或 `/subscriptions-auth` RPC：即使只注册 Codex LLM adapter，Claude 与 Grok 登录仍可用。
- 验证结果：
  - 结构化试验校验器：通过；
  - 冻结 pnpm 安装与 supply-chain policy：通过；
  - 最终组合配置：`providers: [codex]`；
  - 活动 owner 锁拒绝与 stale owner 恢复：通过；
  - 本地 Web 挂载与订阅设置渲染：通过；
  - `git diff --check`：通过；
  - 本次改动的两组双语文档：通过；
  - `pnpm run doc-sync`：28 个门禁中 27 个通过；全仓 translation 门禁被并发新增且缺少 `.i18n.yaml` 记录的任务外 Agent Note 阻塞；
  - `pnpm run lint`：仅被 `packages/host/apiproxy` 中四条任务外 Host 问题阻塞；
  - 仓库 `packages/` 与默认 bundle 不含 subscriptions 集成。

## 决策

- 试验保留在仓库 package 与发布 bundle manifest 之外。
- 准备阶段不执行 OAuth 登录，也不检查主 Harness home。
- 使用专用 Harness home、Codex-only 配置和单进程 launcher。
- 将 0.3.1 的 Codex-only 视为 adapter 配置，而不是认证授权规则；用户不得点击仍然可见的 Claude 或 Grok 登录控件。
- 不使用 `image_generate`，因为 0.3.1 将它与 Codex provider 绑定，且没有独立开关。

## 当前状态

- 隔离 server 正在 `http://127.0.0.1:3081` 监听；它没有订阅凭据。
- 试验已准备好，由用户使用非主力账号手动授权 Codex。
- 扩大使用仍被以下事项阻塞：按 provider 过滤认证、跨进程 store 锁、刷新所有权、独立工具开关，以及 authentication/store/refresh 测试。
- dirty worktree 中已有的 verifier 集成改动保持不动。

## 恢复说明

1. 阅读本日志、已完成的 subscriptions 审计和 `/Users/markus/.dsh-subscriptions-codex-pilot/README.md`。
2. 重启或恢复依赖前运行 `/Users/markus/.dsh-subscriptions-codex-pilot/verify-pilot.mjs`。
3. 只通过 `run-web.sh` 启动，绝不对该 home 运行另一个 DSH 进程。
4. 只用非主力账号授权 Codex；不使用 Claude、Grok 或 `image_generate`。
5. 将列出的加固工作保持为独立任务，并在扩大部署前完成。

## 待确认问题

- Codex OAuth 授权会传输账号凭据并授予持久访问，必须由用户亲自完成。
