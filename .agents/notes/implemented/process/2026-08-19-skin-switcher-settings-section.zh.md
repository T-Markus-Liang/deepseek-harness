# Agent Note：Web GUI 设置页的主题皮肤切换器

状态：已实现

[English](2026-08-19-skin-switcher-settings-section.md) | 中文

## 问题

第三方皮肤包（如 `dsh-deep-whale#maid-atelier`）通过设置一个 body 属性（`bodyAttr`）激活，整套样式都挂在该选择器下，并且加载时无条件自动激活。安装多个皮肤后它们会同时激活——CSS 互相冲突，而 GUI 没有任何切换入口。

## 决策

新增客户端插件包 `@deepseek-ai/dsh-client-ui-skin-switcher`，注册一个设置区块，列出所有已安装皮肤并保证同一时刻只有一个生效。宿主半区扫描 profile `node_modules` 中携带 `skin.json` 清单的包，通过 `GET /dsh-skins` 提供给页面，并把激活选择通过 `POST /dsh-skins/activate` 持久化到 `<profile>/dsh-skins.json`（校验同源）。浏览器半区切换 body 属性：移除所有已知皮肤的 `bodyAttr`，只设置选中的那个；通过插件自有的样式规则隐藏未激活皮肤注入的 `[data-skin-chrome]` 装饰节点；无皮肤激活时恢复默认文档标题。

首次访问且无持久化选择时，采纳当前正在激活页面的那个皮肤，避免切换器静默关掉用户可见的皮肤。`MutationObserver` 监听已知皮肤属性，皮肤稍后自动激活时重新应用选中状态，从而击败皮肤的无条件自激活。

切换器独立于 dshmarket 的服务端主题机制（后者没有 UI，且不识别 `file:` 安装的皮肤）。激活是纯属性替换，不触碰 bundle 装配。

## 备选方案

- **复用 dshmarket 的 `activateTheme`/`disabledThemes`** —— 没有 UI，且 `file:` 安装的皮肤不被识别为主题。
- **卸载未激活皮肤的 bundle** —— 需要 loader 手术，且皮肤的 `apply` 副作用（标题、装饰）会泄漏；属性门控已经能关闭它的样式表。
- **只用 localStorage 持久化选择** —— 宿主路由把选择与 profile 放一起，跨浏览器、跨设备共享。

## 影响

- 用户可安装多个皮肤而不冲突，并从 设置 → 主题皮肤 切换；默认外观（内置主题）始终一键可达。
- 未激活皮肤的装饰节点仍在 DOM 中但被隐藏；后续版本可彻底移除。
- 皮肤列表在设置页挂载时生成；页面打开期间新装皮肤需刷新后出现。
