# @deepseek-ai/dsh-verifier

[English](README.md) | 中文

Verifier Service Definition 提供 `ctx.verifier.select(request)`。请求包含一个问题、完整候选轨迹字符串、命名准则、显式模型、锦标赛参数、并发上限和可选取消信号。结果以输入坐标给出胜者索引、分数、完整排名、比较次数、规范化准则 id 和 Token 用量。

Provider 必须验证所有跨外部边界的结果。候选生成和 Session 投影由 Consumer 负责；本 seam 不是 LLM adapter，也不会修改工作区。

## 模型体验

### Consumer 投影

#### 模型看到的内容

没有直接内容。模型侧 verifier Consumer 负责工具 schema 和结果渲染；`ctx.verifier.select()` 只向这些 Consumer 返回结构化 selection 数据。

#### Token 影响

没有直接 Token 成本。Consumer 决定哪些结果字段进入模型请求。

#### KV Cache 影响

没有直接失效。Consumer 的工具可见性和保留结果负责 cache 影响。

## 已知限制与延期工作

- 首版 API 仅提供 selection；pairwise comparison 和 progress tracking 延期。
- 本 seam 尚不统一图片输入或 verifier cache 存储。
