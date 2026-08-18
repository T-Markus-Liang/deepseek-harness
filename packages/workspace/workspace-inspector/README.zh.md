# @deepseek-ai/dsh-workspace-inspector

[English](README.md) | 中文

Web 工作台「文件 / 变更」视图与右侧详情列预览背后的 Host 侧只读查阅服务。每个方法都通过 `ctx.fs` 把工作区相对路径解析到某一个已注册的工作区根目录之内（含包含性校验与符号链接防护），或通过 `ctx.subprocess` 以固定、参数化的 argv 执行 Git——用户输入从不进入 shell。`listTreeLevel` 返回单层目录（过滤 `.git`，带条目数截断标记）；`readFilePreview` 返回有界 UTF-8 文本及语言提示，拒绝二进制、非常规文件与超限文件；`gitStatus` 将 porcelain v1 解析为分支、领先/落后计数与全部未提交文件；`gitFileDiff` 把单路径的暂存或工作区变更表达为旧/新文本，供浏览器 diff 渲染。失败以 `WorkspaceInspectorError` 抛出，其错误码是浏览器错误态的稳定线上词汇。

本服务明确不提供任何写入、暂存、提交、丢弃、拉取或抓取操作，也不做监听与轮询——每次调用都是一次显式读取。

## 模型体验

None, as the service answers browser-side read-only inspection requests and registers no tool, prompt, or session event.

#### KV Cache effect

None: no model request changes.

## 已知限制与暂缓工作

- **上限为代码内固定值** —— 条目数、文本字节与 Git 输出上限是编译期常量，不支持按部署配置。超出 Git 输出上限的状态返回上限内保留的完整记录并携带 `truncated: true`（分支头可能被截去）；文本基准则仍然失败，因为截断的负载会损坏 diff。
- **无实时失效** —— 调用方显式刷新；本服务不持有文件监听或缓存。
