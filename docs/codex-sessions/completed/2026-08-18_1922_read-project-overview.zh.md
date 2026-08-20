# 阅读项目概况

[English](2026-08-18_1922_read-project-overview.md) | 中文

- 日期：2026-08-18 19:22 CST
- Session id：`01a01499-e19a-7441-9f32-ef8932f3e3f7`
- 项目：DeepSeek Harness
- 工作区：`/Users/markus/deepseek-harness`
- 任务：阅读仓库并建立初步项目理解。
- 状态：已完成
- 分支：`master`，跟踪 `personal/master`

## 用户请求摘要

先阅读项目，在不修改产品代码的前提下给出初步理解。

## 已完成工作

- 阅读 `README.md`、`docs/architecture.md`、`docs/development.md`、`packages/README.md`、根 package manifest、工作区配置和具有代表性的包组 README。
- 检查 CLI 和 Web 入口、近期 commit、包与测试清单，以及工作区状态。
- 运行有界的只读 DeepSeek worker 探索并交叉核对结果。
- 尝试启动原生 explorer subagent，但服务报告高负载而失败；它没有修改仓库文件。

## 决策

- 将仓库理解为由 Cordis 组合的插件运行时，而不是单体聊天应用。
- 以 CLI/profile/bundle 组合、agent loop、持久化 Session 日志、能力 seam 和 Host/Client Web 分层作为主要理解模型。
- 只读概览任务不运行构建或测试套件；创建 Session 日志前工作区是干净的。

## 当前状态

- 仓库版本为 `0.1.0-rc.7`，并明确仍处于开发者预览阶段。
- 源码树在 `packages/` 下包含 49 个包组和 228 个 package manifest。
- master 最近的 commit 集中在只读 Web 工作区 workbench、workspace inspector 接线和 Black Whale 视觉系统。
- 产品代码未变；只新增了可恢复的 Codex Session 元数据。
- 此只读概览无需构建或测试命令。有界 worker 阅读仓库后成功完成，初始 Git 工作区是干净的。

## 恢复说明

1. 阅读本日志和 `docs/codex-sessions/index.md`。
2. 进行架构工作时，先读 `docs/architecture.md`，再读相关的 `packages/<group>/README.md` 和包 README。
3. 修改生命周期、并发、子进程或 teardown 代码前，阅读 `docs/defensive-patterns.md`。
4. 根据变更面选择聚焦检查，不默认运行整个套件。

## 待确认问题

- 用户尚未选择需要深入处理的子系统或具体变更。
