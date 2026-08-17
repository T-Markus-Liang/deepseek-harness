# Agent Note: 黑鲸壳层背景

Status: implemented

[English](2026-08-18-black-whale-shell-backdrop.md) | 中文

## Problem

Web 壳层在中性语义表面之外没有即时的视觉身份。面向用户的品牌背景不能放进会话树里，否则会与会话内容、输入框、拖拽手柄或 overlay slot 竞争；把另一个 client 包的 Logo 组件复制进 layout 包，也会违反 client 包边界。

## Decision

背景归 AppFrame 壳层所有。AppFrame 在 sidebar、conversation 与 details 三列之下渲染一个 aria-hidden、pointer-inert 的图层。该图层使用 Web 自有 SVG `apps/web/public/whale.svg`：图形来自精确的 FishLogo path，但作为静态资产打包，因此 `ui-layout` 不需要导入 `ui-primitives`。资产把鲸鱼渲染为黑色主体与蓝色边缘光；`ui-theme` 拥有浅色和深色的 `--dsw-specific-black-whale-*` token，`AppFrame.module.css` 拥有渐层、声呐环、粒子场和半透明列表面。

可读性优先于氛围。conversation root 保持透明，让壳层背景能出现在留白与空态区域；输入框仍保留接近实体的 token 表面并叠加 backdrop blur。sidebar、center 与 details 三列在 `color-mix()` 玻璃处理之前都先声明实体 token 背景作为回退。装饰层没有指针目标，位于拖拽手柄和 shell overlay 之下，并且在 `prefers-reduced-motion: reduce` 下停止声呐与粒子动画。

## Alternatives considered

**整幅位图或视频**被否决：资产更重、主题适配更难，并且需要额外处理 reduced-motion。

**新增 client plugin 或 slot**被否决：背景没有实时数据、owner 参数或组合需求；为装饰性壳层问题新增 slot 会扩大公共组合面。

**在 ui-layout 中导入 FishLogo**被否决：client plugin 之间禁止跨包导入。静态 Web 资产既保留精确品牌几何，也不削弱这条规则。

**让会话内容与输入框大面积透明**被否决：鲸鱼会直接压在阅读和编辑表面之后。当前实现只让背景透出留白，同时保持内容表面清晰可读。

## Consequences

首次绘制现在在两种调色板中都有明确的 DeepSeek 黑鲸身份，深色模式效果更强。本次不改变任何 slot 契约、session event、store、模型可见输出或业务行为。不支持 `color-mix()` 或 `backdrop-filter` 的旧浏览器会保留实体 token 背景。

`pnpm run test:gui` 通过 273 个文件、3,786 个测试。`DSH_SNAPSHOT=replay pnpm vitest run --config vitest.web.config.ts apps/web/tests/shipped-composition.e2e.ts` 通过 2 个组合测试。`pnpm run build` 完成，并已验证本地 Web 服务提供新的哈希前端资产与 `/whale.svg`。
