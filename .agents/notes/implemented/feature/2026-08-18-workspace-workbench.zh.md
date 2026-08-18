# Agent Note：只读工作区工作台

状态：已实现

[English](2026-08-18-workspace-workbench.md) | 中文

## 问题

Web GUI 此前只展示会话与会话内容。查阅当前工作区的文件或未提交的 Git 变更必须离开应用，而且 Host 没有任何能力把这两类内容暴露给浏览器。直接提供主机路径文件 API 等于把整机的任意读取权交给浏览器；任何 Git 集成也必须保持只读，把写权限留给 Agent 的显式工具调用。

## 决策

该功能以一个 Host 能力加三个浏览器席位落地，全部约束在已注册的工作区根目录内。新的 `dsh-workspace-inspector` 包（Host 侧）通过 `ctx.fs` 解析 `workspaceId +` 工作区相对路径并做包含性校验，过滤 `.git`，拒绝根目录逃逸、二进制文件与超限内容，并通过 `ctx.subprocess` 以固定、参数化的 argv 执行 Git（`GIT_OPTIONAL_LOCKS=0`、无分页器、无终端提示）。四个一元 RPC 方法——`workspace.listTreeLevel`、`workspace.readFilePreview`、`workspace.gitStatus`、`workspace.gitFileDiff`——经 API 代理、fetch 载体与 runtime 的 `IWorkspaces` 接口暴露该能力；diff 以旧/新文本对传输，浏览器得以复用现有 `DiffBlock` 原语。

客户端侧，ui-workspace 的浏览器增加了持久化于其视图 store 的「会话 / 文件 / 变更」模式切换，并声明两个子席位；新的 `ui-workbench` 包以按层惰性加载（每层一次请求）的文件树和按已暂存 / 未暂存 / 未跟踪分组的状态视图填充它们。选中通过新的 `WorkspacePreviewTarget` 契约类型与布局 store 新增的 `preview` 字段流转：`ctx.layout.openPreview(target)` 打开详情列，AppFrame 把目标作为 details 的 owner prop 传入，预览存在时 ui-conversation 的 DetailsPanel 渲染其新的 `conversation.details.workspacePreview` 席位以替代工具详情；关闭详情列即清除目标。每个请求均可中止，被取代的请求绝不写入视图，且不存在任何编辑、暂存、提交、监听或轮询路径。

## 已考虑的替代方案

**以独立工作台包整体替换侧边栏浏览器**被否决：一个席位只有一个占用者，替换 `sidebar.workspaces` 会丢掉会话树、搜索与工作区对话框——本包的第一版正是这样做的，随后被模式切换设计取代。

**把预览嵌入侧边栏内部**被否决：300px 宽的列放不下可读的 diff，还会重复详情列的开合几何；经由布局 store 路由复用了现有面板机制。

**从浏览器发起 shell 或接受绝对路径**在安全边界上被否决：浏览器从不接触主机路径，查阅器的相对路径校验在任何文件系统或 Git 调用之前于 Host 侧执行。

**实时文件监听与后台轮询**在第一版中被否决：手动刷新、进入模式与切换工作区是仅有的重新拉取触发点，使只读界面不引入订阅生命周期。

## 影响

侧边栏无需离开应用即可在会话、工作区文件树与全部未提交 Git 状态之间切换；文件与 diff 在会话旁的详情列中打开。会话日志、模型上下文、工具权限与业务执行均不变化——查阅器只应答读取。各项上限（条目数、文本字节、Git 输出字节）是编译期常量；预览依赖已选中的会话，因为工作区由会话推导。

`pnpm run test:gui` 通过 273 个文件、3,786 个测试。`pnpm run doc-sync` 通过 28 个校验门。发布的 Web 组合通过 `packages/bundle/web-app/cordis.patch.yml` 挂载 `workspace-inspector` 与 `ui-workbench`。
