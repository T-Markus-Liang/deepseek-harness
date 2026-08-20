# 审计 dsh-plugin-subscriptions

[English](2026-08-18_1945_audit-subscriptions-plugin.md) | 中文

- 日期：2026-08-18 19:45 CST
- Session id：`01a01499-e19a-7441-9f32-ef8932f3e3f7`
- 项目：DeepSeek Harness
- 工作区：`/Users/markus/deepseek-harness`
- 任务：审计 `V1ki/dsh-plugin-subscriptions`，并评估它与本地 Harness 项目的集成。
- 状态：已完成
- 分支：`master`，跟踪 `personal/master`

## 用户请求摘要

阅读外部订阅提供方插件，说明其功能，并判断本地 DeepSeek Harness checkout 是否以及如何使用它。

## 已完成工作

- 检查公开仓库 `V1ki/dsh-plugin-subscriptions` 的 commit `a3ccede72f9d00739cead03dec5652f08a0e70ba` 和 npm 包 `dsh-plugin-subscriptions@0.3.1`。
- 阅读 manifest、bundle patch、OAuth 流、凭据和模型 cache 存储、RPC 与 Web 设置面、Codex/Claude/Grok 适配器、请求转换器、SSE 解析器、工具和单元测试。
- 将插件导入的 API 与 Harness `0.1.0-rc.5` 至本地 `0.1.0-rc.7` 版本及当前工作区接口进行对比。
- 在不运行 package script 的情况下下载签名 npm tarball，并检查文件清单和 runtime bundle 是否存在意外的进程执行入口。
- 在隔离的临时 `DSH_HOME` 中，针对本地工作区 runtime 加载并挂载已发布 node bundle；它在没有凭据或 provider 网络调用的情况下注册了 `claude`、`codex` 和 `grok`。
- 检查有关 Claude 账号封禁的未关闭 issue，以及替换陈旧硬编码 Claude Code 身份字段的未关闭 PR。
- 尝试原生和有界外部 worker 评审。原生 worker 因服务高负载失败，外部 worker 超时且未修改文件，因此主任务直接完成只读审计。
- 审计后将临时源码 clone、下载的 npm 产物和隔离 home 移到 macOS 废纸篓。

## 决策

- 将该插件视为外部可选插件，不 vendoring 到 `packages/`，也不挂载到默认 profile。
- 不将它描述为免费 API 访问：它通过 OAuth 支持的 CLI/私有端点消耗用户现有 ChatGPT、Claude 或 Grok 订阅额度。
- 暂不安装用于日常使用。试用时应固定 npm `0.3.1`、使用隔离 `DSH_HOME`、只启用一个提供方，并且只运行一个 Harness 进程。
- 首次实验优先 Codex。Claude 的执行风险最高，因为适配器显式以 Claude Code 身份呈现，带有硬编码 CLI 版本、身份提示词、beta flag 和宽泛 OAuth scope。
- 广泛使用前要求上游修复或使用本地 fork：跨进程凭据锁定/刷新所有权、收窄或证明 scope 合理、工具独立启用、provider replay-state 支持，以及 OAuth/store/refresh 行为测试。

## 当前状态

- 产品代码和依赖未变；只新增 Codex Session 元数据。
- 插件在技术上可信，并遵循当前 Harness 扩展点：自激活 bundle patch、`ctx.llm` 适配器、可选 `ctx.tools`、仅 loopback 的 Host RPC、Web 设置客户端和附件集成。
- OAuth 使用 PKCE、随机 state、loopback callback、自动刷新和仅所有者可访问的原子凭据文件替换。Token 仍以明文保存在 `~/.dsh/plugins/subscriptions/auth.json`。
- 凭据存储采用无锁的整文件读/改/写。不同 Web/headless 进程可能并发刷新同一个轮换 token；永久错误路径随后可能删除另一个进程刚保存的 Session。
- OAuth scope 超过插件实际使用的能力。Claude 请求 `org:create_api_key`、MCP-server 和文件上传 scope；Codex 请求 connector 读取/调用 scope。
- Codex 请求加密的 reasoning content，但转换器不会持久化或回放它。Responses 与 Anthropic 转换器都会在后续请求中显式省略 reasoning block。
- 启用 Grok 或 Codex 会自动注册 `x_search` 或 `image_generate`；没有独立配置开关。
- 仓库非常新，没有 GitHub Actions workflow 或 GitHub Release，其认证/store/refresh 逻辑缺少专门测试。npm 包有 registry 签名和完整性 hash，但相应 Git commit 未签名，npm 元数据也未公开 `gitHead`。

## 验证

- 外部 clone 中的 `git diff --check`：通过。
- 已发布 bundle 针对本地工作区包的导入：通过。
- 隔离挂载冒烟测试：注册 `claude,codex,grok`，未写入凭据文件。
- 未安装依赖、构建源码、登录提供方、读取真实凭据或发出模型/API 请求。

## 恢复说明

1. 阅读本日志和任务最终审计建议。
2. 如果获准试用，先决定启用哪个单一提供方并创建独立 `DSH_HOME`；不要让 Web 和 headless 进程共享其 auth store。
3. 固定 npm tarball 完整性，而不是从 GitHub `main` 安装。
4. 日常使用前修复 auth-store 竞态和跨进程刷新协调，添加 auth 生命周期测试，并为可选工具添加配置开关。
5. 试用时重新核对提供方条款和当前官方 CLI 协议行为；这些私有及 CLI 限定端点可能在没有兼容通知的情况下变化。

## 待确认问题

- 用户需要的只是风险报告、隔离的单提供方试用，还是加固后的本地 fork。
- 用户愿意向非官方客户端提供哪个订阅账号（如果有）。
