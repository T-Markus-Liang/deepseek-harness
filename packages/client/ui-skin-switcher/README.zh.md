# @deepseek-ai/dsh-client-ui-skin-switcher

[English](README.md) | 中文

主题皮肤切换器：在设置页列出已安装的主题皮肤，一键切换当前皮肤。

## 它是什么

Web GUI 的内置主题只有 明/暗/跟随系统 三档。第三方皮肤包（如
`dsh-deep-whale#maid-atelier`）自带 `skin.json` 清单，通过设置一个 body
属性（`bodyAttr`，如 `data-dsh-maid-atelier`）来激活，整套样式都挂在该
选择器下。安装多个皮肤后它们会同时激活——CSS 互相冲突。

本插件在设置页提供一个"主题皮肤"区块，列出所有已安装皮肤，并保证同一
时刻只有一个生效：

- **列出**：宿主扫描 profile `node_modules` 中携带 `skin.json` 的包，通过
  `GET /dsh-skins` 提供给页面。
- **切换**：浏览器半区移除 `<body>` 上所有已知皮肤的 `bodyAttr`，只设置
  选中的那个，并通过 `POST /dsh-skins/activate` 持久化选择（写入
  `<profile>/dsh-skins.json`）。
- **恢复**：页面加载时浏览器半区重新应用持久化的选择，覆盖皮肤自身的
  无条件自动激活。

## 宿主路由

| 路由 | 方法 | 用途 |
| --- | --- | --- |
| `/dsh-skins` | GET | 返回 `{ skins, active }` |
| `/dsh-skins/activate` | POST | 持久化 `{ id }`（传 `null` 表示使用默认外观） |

activate 路由拒绝跨域 POST 与未知皮肤 id。

## 模型体验

无，本包是一个设置项，仅切换 body 属性；它做的一切都不会触达模型请求。

#### KV 缓存影响

无；本包既不组装也不发送任何 provider 请求。

## 已知限制与后续工作

- 切换是 body 属性替换，不是 bundle 卸载：未激活皮肤的注入装饰节点仍
  留在页面中（样式被关掉所以不可见）。后续版本可显式隐藏它们。
- 皮肤列表在设置页挂载时生成；打开页面期间新装皮肤需刷新后才会出现。
