# OpenAI 兼容渠道协议扩展实施记录

## 任务

为 `openai-compatible` 渠道增加 Chat Completions 与 Responses 协议支持，并保持现有配置兼容。

## 落地范围

- [x] 新增后端 RED 测试：`tests/openai_compatible_driver_protocols.test.ts`，验证 `protocol=responses` 时调用 `/v1/responses` 且发送 `input`。
- [x] 补充协议路径 RED 测试：`protocol=responses` 遇到旧默认 `/v1/chat/completions` 时必须归一化为 `/v1/responses`。
- [x] 补充外部复核发现的边界测试：绝对 URL + 尾斜杠旧 chat endpoint 必须保留 host 并改为 `/v1/responses`；未显式 protocol 的 `/v1/responses-log` 不得误判为 responses。
- [x] 新增配置 RED 测试：非法 `extra.protocol` 保存应返回 400，合法 `chat/responses` 应规范化。
- [x] 复核补充 RED 测试：非法 `OPENAI_COMPATIBLE_PROTOCOL` 环境变量必须显式失败，且不得发起上游请求。
- [x] 新增前端 RED 测试：渠道表单保存和回填 `protocol`。
- [x] 实现 OpenAI 兼容驱动协议解析、请求体构建和响应解析。
- [x] 实现 `ChannelConfigService` 对 `extra.protocol` 的规范化与校验。
- [x] 实现前端 `ChannelFormState`、helper、hook 和面板协议选择。
- [x] 运行定向测试、`bun run build` 和 `git diff --check`。
- [x] 回写 implementation record。
- [ ] 提交并推送。

## 证据

- `bun test tests/openai_compatible_driver_protocols.test.ts --max-concurrency 1`：9 pass，0 fail。
- `bun test tests/channel_access_panel_accessibility.dom.test.tsx --max-concurrency 1`：6 pass，0 fail。
- `bun test tests/model_channels.test.ts tests/multi_tenant_channel_api.test.ts tests/use_auth_organization_channel_manager.logic.test.tsx tests/openai_compatible_driver_protocols.test.ts tests/channel_access_panel_accessibility.dom.test.tsx --max-concurrency 1`：24 pass，0 fail。
- `bun test tests/frontend_backend_api_alignment.test.ts`：1 pass，0 fail。
- `bun run quality:api-contract`：passed，routeCount 111，failures 0。
- `bun run lint`：退出码 0。
- `bun run build`：退出码 0。
- `bun run test:dom`：70 pass，0 fail。
- `git diff --check`：退出码 0。
- `bun test tests/workflow_docs_presence.test.ts`：5 pass，0 fail。
- `bun run test`：590 pass，0 fail。
- Claude 初次复核：未发现阻断问题，提示路径工具重复为低风险维护项。
- Gemini 初次复核：发现 `extractContent` 存在 chat/responses 响应 schema 交叉静默兜底，并指出渠道行核心按钮缺少 `id="btn-*"` 物理 ID。
- 已修复 Gemini 复核问题：协议响应解析改为严格按 `protocol` 隔离，并补充交叉 schema 回归测试；渠道行“校验配置 / 保存”按钮补充 `btn-*` 物理 ID 和 DOM 断言。
- Claude 二次复核：确认未发现阻塞问题。
- Gemini 二次复核：确认未发现阻塞问题。
- 提交与推送：由最终收尾提交执行。
