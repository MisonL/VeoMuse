# OpenAI 兼容渠道协议扩展设计

## 背景

当前 `openai-compatible` 渠道已经支持自定义 Base URL、API Key、model、path 和 temperature，但驱动固定按 Chat Completions 负载发送 `messages`。用户要求增加更多 API 渠道支持，至少支持 OpenAI 兼容接口的 Chat 和 Responses 两种协议。

## 目标

- 保留现有 Chat Completions 行为：默认路径仍为 `/v1/chat/completions`，请求体继续使用 `messages`。
- 增加 Responses 协议：当配置 `protocol=responses` 或路径为 `/v1/responses` 时，请求体使用 `input`。
- 支持环境变量和组织/工作区渠道配置两种来源。
- UI 渠道面板允许选择 OpenAI 兼容协议，并随配置保存到 `extra.protocol`。
- 不引入静默降级；非法 protocol 应在保存或测试配置时显式失败。

## 非目标

- 不接入真实 OpenAI 凭据做 live 请求。
- 不实现 streaming、tools、file input 或 function calling。
- 不改变现有 `video/generate` 外部响应结构。

## 验收

- 后端驱动测试覆盖 Chat 请求体、Responses 请求体和 Responses 响应解析。
- 渠道配置校验拒绝非法 OpenAI protocol。
- 前端 helper/hook 测试覆盖 `extra.protocol` 保存和回填。
- 相关测试、构建或最小验证通过，`git diff --check` 通过。
