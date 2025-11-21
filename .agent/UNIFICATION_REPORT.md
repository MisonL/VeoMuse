# 前后端逻辑统一与补全报告

## 1. 批量生成 (Batch) 功能统一
- **问题**: 前端 `BatchManager` 缺少获取批量模板和统计信息的 API 方法，且使用了错误的通用模板接口。
- **修复**:
  - 在 `public/js/api.js` 中添加了 `getBatchTemplates`, `createBatchTemplate`, `getBatchStats` 方法。
  - 更新 `public/js/batch.js` 中的 `loadTemplates` 方法，使其调用 `API.getBatchTemplates()` 而非 `API.getPromptTemplates()`，确保使用后端专门为批量任务设计的接口 `/api/batch/templates`。

## 2. 视频生成功能补全
- **问题**: 后端支持 `negativePrompt` (负面提示词)，但前端 UI 和 API 调用中缺失此功能。
- **修复**:
  - 在 `public/index.html` 中为 "文字转视频" 和 "图片转视频" 添加了 "负面提示词" 输入框。
  - 在 `public/js/i18n.js` 中添加了相应的中英文翻译 (`negativePromptLabel`, `negativePromptPlaceholder`)。
  - 更新 `public/js/app.js` 以读取负面提示词输入。
  - 更新 `public/js/api.js` 中的 `generateTextToVideo` 和 `generateImageToVideo` 方法，支持传递 `negativePrompt` 参数。

## 3. 逻辑去重与清理
- **问题**: 后端存在两个重复的提示词优化接口 (`/api/optimize-prompt` 和 `/api/prompts/optimize`)。
- **修复**:
  - 移除了 `src/controllers/VideoController.js` 中的 `optimizePrompt` 方法。
  - 移除了 `src/routes/video.js` 中的 `/optimize-prompt` 路由。
  - 前端统一使用 `/api/prompts/optimize` (由 `PromptController` 处理)，保持逻辑单一。

## 4. Bug 修复
- **问题**: `VideoController.js` 中转码默认分辨率拼写错误 (`702p`)。
- **修复**: 修正为 `720p`。

## 5. 认证系统说明
- **现状**: 后端 `auth.js` 包含完整的用户认证系统，但前端目前未实现登录 UI。
- **兼容性**: 后端 `authenticateToken` 中间件在开发环境 (`NODE_ENV !== 'production'`) 会自动注入模拟用户，因此前端在无登录状态下仍可正常调用受保护的 API (如批量生成)。这符合当前"暂不包含用户账户系统"的开发阶段需求。

所有发现的不匹配项均已修复或确认兼容。
