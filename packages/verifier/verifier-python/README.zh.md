# @deepseek-ai/dsh-verifier-python

[English](README.md) | 中文

本 provider 每次选择启动一个 Python 进程，把 TypeScript bundle 内嵌的 bridge 源码写入私有操作目录后处理一个 JSON 请求。导出的 `LLM_VERIFIER_REQUIREMENT` 为 `llm-verifier==0.2.0`，内嵌 bridge 还会独立要求 `PACKAGE_VERSION = "0.2.0"`；如果安装版本不一致，bridge 会在选择前拒绝执行。

每次操作使用私有临时 cwd，因此上游 `.env` 发现不会读取候选项目。`dsh-subprocess` 会剥离环境中形似凭据的变量；多候选操作只解析一个配置的凭据引用，并以 `credentialEnv` 指定的名称显式转发。只有配置后才转发 `OPENAI_BASE_URL`。stdout 和 stderr 都有字节上限，stdout 必须是一个带版本的 JSON 值。取消会终止整个进程树，provider 在定态前等待进程退出。

默认策略保持保守：最多四个并发 verifier 调用、`on_error="raise"`、禁用上游评分 cache、禁用进度输出。部署负责在 `pythonCommand` 指定的 Python 环境中安装精确依赖。

## 模型体验

### Provider 结果

#### 模型看到的内容

没有直接内容。Verifier Consumer 从 `ctx.verifier` 接收经过验证的 selection 数据；bridge 失败会成为有界 Consumer 错误，而不是原始 Python 输出。

#### Token 影响

没有直接对话 Token 成本。Verifier API 用量作为结构化计数返回，由 Consumer 选择性暴露。

#### KV Cache 影响

不会直接让对话模型 cache 失效。独立 verifier backend 管理自己的 prompt cache。

## 已知限制与延期工作

- Python 环境由部署提供；本包不会执行 `pip`。
- 每次选择启动一个进程，不保留预热 client pool。
- 每个实例只转发一个凭据引用和可选 OpenAI-compatible base URL。
