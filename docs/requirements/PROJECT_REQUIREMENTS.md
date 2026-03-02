# VeoMuse 项目需求文档（Conductor 资产转换版）

> 生成时间：2026-03-01T23:22:58.985Z  
> 转换来源：`conductor/` 全量资产（共 120 个文件，Markdown 93，JSON 27）

## 1. 文档目的与范围

本文档用于将历史 `conductor` 规划资产正式收敛为项目当前可执行需求基线，供产品、研发、测试、运维统一使用。  
配套可追溯清单见：`docs/requirements/CONDUCTOR_ASSET_CONVERSION_MAP.md`。

## 2. 产品定义需求（PRD）

### 2.1 产品定位与目标用户
- **内容创作者**：需要高质量、低成本视频素材的自媒体、UP 主及艺术家。
- **技术爱好者**：追求最新 AI 技术落地体验、关注 Gemini 生态的极客。
- **营销团队**：需要快速产出广告素材、进行批量视频生成的专业机构。
- **Gemini Native**：深度适配 Gemini Veo 3.1 最新模型，支持多 API Key 轮询，保障生成稳定性。
- **Premium Design**：极致的视觉质感，提供流畅的交互反馈。支持专业级多主题切换（亮色/暗色/系统同步），具备物理级色彩一致性。
- **Batch Processing**：支持大批量并发任务，具备完善的任务队列和状态监控。
- **多轮修改与实时编辑**：不仅是生成，更支持对生成结果的持续微调和实时预览。
- **AI 智能翻译层**：AI 根据需求给出剪辑建议和生成提案，并能根据提案自动完成处理。
- **全流程后期支持**：集成导出转码、特效添加、轻量剪辑功能，实现从创意到成片的一站式闭环。
- **多模型矩阵**：引入 Sora, Kling 等更多顶级 AI 视频模型，建立模型超市。
- **专业级剪辑对齐**：全功能对齐剪映专业版，并优化工作流。
- **AI 创意引擎**：深化 AI 在脚本生成、分镜设计、配乐推荐等环节的参与度。

### 2.2 体验与品牌要求
- **定位**：充满活力的创意伙伴 (Enthusiastic & Creative Partner)。
- **规范**：语气应富有感染力，不仅是执行命令，更要像是在与用户一起共创。
- **核心风格**：玻璃拟态 (Glassmorphism)。
- **关键元素**：磨砂玻璃效果、流动背景、Premium 质感。
- **专业掌控**：保留关键参数调节权限。
- **趣味等待**：生成过程中提供生动的反馈。
- **反馈闭环**：每一个操作都有即时的视觉或触觉确认。

## 3. 架构与工程约束需求

### 3.1 技术栈基线
- **运行时 (Runtime)**: **Bun** (极速 IO 与文件处理)
- **后端框架 (Backend)**: **Elysia.js** (高性能，完美支持 Bun)
- **类型同步 (Type Safety)**: **Eden Treaty** (实现前后端 100% 类型自动同步)
- **架构模式**: **Monorepo (Bun Workspaces)**
- \`apps/backend\`: Elysia API
- \`apps/frontend\`: Vite + React
- \`packages/shared\`: 共享类型与工具函数
- **框架**: **React 18+** (用于构建复杂的剪辑交互)
- **构建工具**: **Vite**
- **样式**: **原生 CSS / CSS Modules** (极致的玻璃拟态定制)
- **动画**: **Framer Motion** (Premium 级别的交互动画)
- **状态管理**: **Zustand** (轻量且高性能)
- **主题系统**: **Zustand + CSS Variables** (支持持久化 Light/Dark/System 模式切换)
- **数据库**: **PostgreSQL** (主存储) + **Redis** (缓存与任务队列)
- **实时通信**: **WebSockets (Elysia)**
- **视频处理**: **FFmpeg (fluent-ffmpeg)** + **Canvas API** (用于前端视频预览)

### 3.2 开发流程与质量门禁
- Create a new test file for the feature or bug fix.
- Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
- **CRITICAL:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Do not proceed until you have failing tests.
- Write the minimum amount of application code necessary to make the failing tests pass.
- Run the test suite again and confirm that all tests now pass. This is the "Green" phase.
- With the safety of passing tests, refactor the implementation code and the test code to improve clarity, remove duplication, and enhance performance without changing the external behavior.
- Rerun tests to ensure they still pass after refactoring.
- **STOP** implementation
- Update \`tech-stack.md\` with new design
- Add dated note explaining the change
- Resume implementation
- Stage all code changes related to the task.
- Propose a clear, concise commit message e.g, \`feat(ui): Create basic HTML structure for calculator\`.
- Perform the commit.
- **Step 9.1: Get Commit Hash:** Obtain the hash of the *just-completed commit* (\`git log -1 --format="%H"\`).
- **Step 9.2: Draft Note Content:** Create a detailed summary for the completed task. This should include the task name, a summary of changes, a list of all created/modified files, and the core "why" for the change.

### 3.3 代码规范要求
- Code should be easy to read and understand by humans.
- Avoid overly clever or obscure constructs.
- Follow existing patterns in the codebase.
- Maintain consistent formatting, naming, and structure.
- Prefer simple solutions over complex ones.
- Break down complex problems into smaller, manageable parts.
- **Variable Declarations:** Always use \`const\` or \`let\`. **\`var\` is forbidden.** Use \`const\` by default.
- **Modules:** Use ES6 modules (\`import\`/\`export\`). **Do not use \`namespace\`.**
- **Exports:** Use named exports (\`export {MyClass};\`). **Do not use default exports.**
- **Classes:**
- **Do not use \`#private\` fields.** Use TypeScript's \`private\` visibility modifier.
- Mark properties never reassigned outside the constructor with \`readonly\`.
- **Never use the \`public\` modifier** (it's the default). Restrict visibility with \`private\` or \`protected\` where possible.
- **Functions:** Prefer function declarations for named functions. Use arrow functions for anonymous functions/callbacks.
- **File Naming:** All lowercase, with underscores (\`_\`) or dashes (\`-\`). Extension must be \`.js\`.
- **File Encoding:** UTF-8.
- **Whitespace:** Use only ASCII horizontal spaces (0x20). Tabs are forbidden for indentation.
- New files should be ES modules (\`import\`/\`export\`).
- **Exports:** Use named exports (\`export {MyClass};\`). **Do not use default exports.**
- **Imports:** Do not use line-wrapped imports. The \`.js\` extension in import paths is mandatory.
- **Braces:** Required for all control structures (\`if\`, \`for\`, \`while\`, etc.), even single-line blocks. Use K&R style ("Egyptian brackets").
- **Indentation:** +2 spaces for each new block.
- **Protocol:** Use HTTPS for all embedded resources.
- **Indentation:** Indent by 2 spaces. Do not use tabs.

## 4. 功能需求基线（V3.1）

### 4.1 冻结基线需求（BL）
- [x] `BL-01` Bun Monorepo 前后端联调 + Eden Treaty 类型同步
- [x] `BL-02` AI 提示词增强 + 视频生成 + WebSocket 实时进度
- [x] `BL-03` 多轨时间轴拖拽/裁剪/同步预览
- [x] `BL-04` 导出合成视频（`/api/video/compose`）
- [x] `BL-05` 素材库 + 磁吸 + 撤销重做
- [x] `BL-06` 属性检查器 + 缩放 + 右键菜单
- [x] `BL-07` 转场 + 文字动画 + 滤镜导出
- [x] `BL-08` TTS + BGM 匹配 + 音量平衡
- [x] `BL-09` 多模型实验室与分屏对比
- [x] `BL-10` AI 导演脚本分析与分镜编排
- [x] `BL-11` 节奏吸附 + 音色克隆 + 3D 透视能力
- [x] `BL-12` 亮/暗/系统主题切换与持久化
- [x] `BL-13` Docker + Nginx 部署路径
- [x] `BL-14` 全量蓝图对齐标准

### 4.2 核心功能需求（P0）
- [x] `P0-01` Luma/Runway/Pika 可用并可触发生成
- [x] `P0-02` 新模型驱动标准化 + 智能路由推荐
- [x] `P0-03` 翻译并克隆闭环
- [x] `P0-04` 风格重塑预设与回写
- [x] `P0-05` 演员库管理与一致性锁定
- [x] `P0-06` 口型同步链路
- [x] `P0-07` 4K HDR 导出
- [x] `P0-08` 动作捕捉实验室同步
- [x] `P0-09` 3D 自由视角预览
- [x] `P0-10` 空间视频导出
- [x] `P0-11` VFX 粒子层应用与预览
- [x] `P0-12` World-Link 场景一致性
- [x] `P0-13` 全 AI 服务 BaseAiService 统一监控
- [x] `P0-14` API 异常重试/降级恢复交互
- [x] `P0-15` 长时间轴性能优化（虚拟化）
- [x] `P0-16` `useActionState + useOptimistic` 核心流程落地
- [x] `P0-17` 亮色 Premium 主题与 Spring 动效
- [x] `P0-18` SyncController Native 化与预算控制
- [x] `P0-19` Nginx CSP + 自动清理任务

### 4.3 审计可信度需求（P1）
- [x] `P1-01` `tracks.md` 与 archive/plan 1:1 对齐
- [x] `P1-02` `metadata.json` 状态与执行状态一致
- [x] `P1-03` 清除验证状态自相矛盾条目
- [x] `P1-04` User Manual Verification 全部补齐
- [x] `P1-05` 建立需求->测试->验收映射矩阵（见本文 §7）
- [x] `P1-06` full_blueprint_alignment 三项标准定量化（同上文档）

### 4.4 路线增强需求（P2）
- [x] `P2-01` 模型超市治理策略（能力/成本/成功率/延迟画像）
- [x] `P2-02` AI 创意引擎自动闭环深化
- [x] `P2-03` 协作平台化（团队空间/云存储/多人协同）

### 4.5 P0 实施工作包状态
- [x] `WP-A1` 模型通道闭环（已完成：推荐路由扩展 + 降级策略 + 测试）
- [x] `WP-A2` 媒体炼金术闭环（已完成：style-transfer 真路由 + 翻译克隆 UI + 测试）
- [x] `WP-A3` 数字演员系统闭环（已完成：演员库 API + UI 入口 + 4K HDR 导出预设 + 口型同步测试）
- [x] `WP-A4` 虚实共生闭环（已完成：动捕实验室 + actors/motion-sync + 2D/3D 预览切换 + 空间导出回归测试）
- [x] `WP-A5` 影棚特效与 World-ID 闭环（已完成：VFX 写回片段预览 + world_link/world_id 参数链路 + 回归测试）
- [x] `WP-B1` AI 架构统一与容错自愈（已完成：前端降级恢复入口 + 重试/降级继续编辑动作 + 测试）
- [x] `WP-B2` 时间轴性能与交互升级（已完成：虚拟化 + Action/Optimistic + SyncController 性能预算 + 测试）
- [x] `WP-B3` 亮色主题与动效统一（已完成：亮色默认主题、变量收敛、App 内联主题常量清理 + 测试）
- [x] `WP-C1` 生产安全与自动清理（已完成：Nginx 最小权限 CSP + always 安全头 + 清理任务重试遥测 + 测试）

## 5. 下一阶段需求（V3.2）

### 5.1 北极星目标（NS）
- 关键主链路（注册/组织/工作区/协作/导出）端到端成功率 >= 99.5%
- 非 AI API（工作区、存储、策略）P95 响应时间 <= 400ms
- 新用户首次完成“创建工作区 -> 生成 -> 导出”平均步骤 <= 8
- 数据库损坏修复演练脚本每周稳定通过
- 主分支安全门禁（secrets 扫描、鉴权回归、多租户越权回归）全绿

### 5.2 第一批 P0 任务
- [ ] 将 `ComparisonLab.tsx` 拆分为模式级容器 + 领域子组件（降低耦合）
- [ ] 建立“功能导览 / 新手引导”最小可用版本
- [ ] 增加浏览器级 E2E：注册 -> 组织 -> 工作区 -> 生成 -> 导出
- [ ] 增加配额模型（组织维度请求次数与存储量）
- [ ] 增加策略变更审计导出接口
- [ ] 补齐发布门禁：E2E + secrets + build + smoke

## 6. 轨道需求总览（Archive 26 轨）

- 轨道数：`26`
- 计划任务总数（官方基线，来源 rebaseline）：`174`
- 已完成任务数（官方基线，来源 rebaseline）：`174`
- 计划清单项总数（按 archive/plan 勾选行自动统计，含子任务）：`330`
- 已完成清单项（同口径）：`330`

| 序号 | Track ID | 类型 | 状态 | 计划完成 | 需求摘要 |
| --- | --- | --- | --- | --- | --- |
| 1 | ai_audio_revolution_20260225 | feature | completed | 6/6 | AI 音频革命：智能配音 (TTS) 与创意背景音乐合成 |
| 2 | ai_channels_explosion_20260226 | feature | completed | 11/11 | AI 渠道大爆发：集成 Luma Dream Machine、Runway Gen-3 与 Pika 1.5 顶级模型集群 |
| 3 | ai_dimension_breakthrough_20260225 | feature | completed | 12/12 | AI 维度突破：3D 空间感知预览、AI 变声克隆与智能节奏对齐引擎 |
| 4 | ai_director_peak_20260225 | feature | completed | 12/12 | AI 创意巅峰：‘一键导演’自动化剪辑、语义级画面蒙版与智能叙事修复 |
| 5 | ai_media_alchemy_20260226 | feature | completed | 13/13 | AI 媒体炼金术：多语种配音同步翻译、视频实时风格迁移与智能素材增强 |
| 6 | ai_mixed_reality_20260226 | feature | completed | 11/11 | 虚实共生：AI 实时动作捕捉同步、4K 神经辐射场 (NeRF) 渲染与沉浸式 VR 空间导出 |
| 7 | ai_studio_evolution_20260226 | feature | completed | 9/9 | AI 影棚级进化：智能重光照 (Relighting)、神经渲染特效与全场景一致性引擎 |
| 8 | ai_virtual_actors_20260226 | feature | completed | 12/12 | 数字人永生：生成式虚拟演员、高精度对口型 (Lip-Sync) 与 4K HDR 极速渲染引擎 |
| 9 | bug_bash_final_20260226 | bug | completed | 11/11 | 旗舰版全量 Bug 猎杀：前端渲染异常、状态同步边界与 API 健壮性深度加固 |
| 10 | editor_excellence_plan_20260225 | feature | completed | 15/15 | 编辑器卓越计划：磁吸对齐、全能素材中心与撤销重做系统 |
| 11 | editor_polish_and_composition_20260225 | feature | completed | 17/17 | 编辑器深度打磨：高级交互、多片段拖拽与后台合成引擎 |
| 12 | editor_precision_20260225 | feature | completed | 11/11 | 工匠之手：属性面板、精细化时间轴控制与专业右键菜单 |
| 13 | editor_visual_fx_20260225 | feature | completed | 6/6 | 视觉艺术进阶：片段转场特效、文字动态预设与全局滤镜引擎 |
| 14 | final_polish_20260226 | feature | completed | 11/11 | 旗舰版全功能极致打磨与体验抛光：音量平衡、渲染动效与交互细节优化 |
| 15 | full_blueprint_alignment_20260227 | feature | completed | 16/16 | 补全所有规划的功能与前端功能的偏差，100% 对齐历史蓝图 |
| 16 | init_monorepo_20260225 | feature | completed | 17/17 | 构建 VeoMuse 旗舰版 Monorepo：初始化 Bun Workspaces 并搭建 Elysia 与 React 基础脚手架 |
| 17 | launch_and_deployment_20260226 | feature | completed | 6/6 | 旗舰版商业化上线：Docker 容器化、Nginx 高性能部署与全平台发布指南 |
| 18 | migrate_core_logic_20260225 | feature | completed | 17/17 | 核心业务迁移与 AI 创意引擎实现：重构 Video 逻辑并实现 AI 智能翻译层 |
| 19 | multi_model_orchestrator_20260225 | feature | completed | 13/13 | 全球模型总线：多模型架构抽象、Sora/Kling 对接与智能对比实验室 |
| 20 | pro_mastery_boost_20260226 | feature | completed | 8/8 | 专业级增强：全局快捷键、智能预加载与全链路遥测看板 |
| 21 | theme_system_20260227 | feature | completed | 19/19 | 开发主题系统 |
| 22 | ultimate_excellence_20260226 | feature | completed | 13/13 | 极致卓越：架构抽象化、全链路性能量化与高可用健壮性加固 |
| 23 | ultimate_optimize_20260226 | feature | completed | 25/25 | 全部优化好！全方位对齐 2026 最佳实践 |
| 24 | ultimate_polish_20260226 | feature | completed | 16/16 | 全部处理好！全方位性能量化、代码复用提升与 UX 深度打磨 |
| 25 | video_editor_core_20260225 | feature | completed | 17/17 | 次世代多轨道视频编辑器：构建时间轴、预览引擎与 AI 自动剪辑基础 |
| 26 | visual_storytelling_20260225 | feature | completed | 6/6 | 视听叙事大师：动态文字、多音轨母带处理与转场特效引擎 |

## 7. 测试与验收要求

> 来源：`conductor/requirements_test_matrix_20260228.md`

- P0/P2 需求必须具备“自动化测试 + 手工验收要点”双重映射。
- 回归范围至少覆盖：模型路由、导演分析、媒体炼金、演员一致性、动捕同步、VFX、导出、监控。
- 视觉一致性需遵循主题变量统一与亮/暗模式切换可验证。

以下为原矩阵资产内容（用于审计留存）：

```md
# VeoMuse 需求-测试-验收映射矩阵（2026-02-28）

## P0 映射清单

| 需求ID | 自动化测试 | 手工验收要点 |
|---|---|---|
| `P0-01` 模型选择器可用 Luma/Runway/Pika | `tests/model_channels.test.ts` | 模型实验室左右模型下拉均可选择 3 个新模型并提交生成 |
| `P0-02` 新模型驱动与路由推荐 | `tests/model_router_recommendation.test.ts` | 输入不同提示词，推荐模型会自动回填 |
| `P0-03` 翻译并克隆 | `tests/media_alchemy_translation.test.ts`, `tests/media_alchemy_translation_frontend_clone.test.ts` | 属性面板触发翻译后时间轴新增克隆片段，克隆片段 `start/end/content/translatedFrom` 正确 |
| `P0-04` 风格预设实时预览 | `tests/media_alchemy_style_transfer.test.ts`, `tests/media_alchemy_style_vfx_preview_data.test.ts` | 选择风格预设后片段 `data` 写入 `stylePreset/styleModel/styleOperationId` 并可用于预览反馈 |
| `P0-05` 演员库管理与一致性 | `tests/virtual_actors_api.test.ts` | 新增演员后可在属性面板绑定并用于生成 |
| `P0-06` 口型同步 | `tests/lip_sync_flow.test.ts` | 打开口型同步并生成时后端兼容 `sync_lip` 并标准化透传 `syncLip: true` |
| `P0-07` 4K HDR 导出 | `tests/composition_service.test.ts` | 导出菜单可选 4K HDR，输出命名含 HDR 标识 |
| `P0-08` 动捕同步演员 | `tests/motion_capture_mapping.test.ts` | 启动动捕流并同步到演员，状态提示成功 |
| `P0-09` 3D 自由视角 | `tests/spatial_preview_mode.test.ts` | 预览区切换 3D 后可拖拽改变视角 |
| `P0-10` 空间视频导出 | `tests/composition_api.test.ts` | 导出选中空间视频后返回有效输出路径 |
| `P0-11` VFX 粒子层应用预览 | `tests/vfx_apply_flow.test.ts`, `tests/media_alchemy_style_vfx_preview_data.test.ts` | 选择 VFX 类型和强度后片段 `data` 写入 `vfxType/vfxIntensity/vfxOperationId` 并驱动叠加效果 |
| `P0-12` World-Link 一致性 | `tests/world_link_consistency.test.ts` | 连续请求开启 world-link 且复用同一 worldId 时，驱动 payload 保持一致透传 |
| `P0-13` 全 AI 服务统一 BaseAiService | `tests/base_ai_inheritance_coverage.test.ts` | `/api/admin/metrics` 能看到各 AI 服务计量 |
| `P0-14` API 故障可恢复降级 | `tests/degrade_recovery_ui.test.ts`, `tests/resilience_demo.test.ts` | 失败提示中可点击“重试/降级继续编辑”且不阻塞编辑 |
| `P0-15` 长时间轴性能 | `tests/timeline_virtualization.test.ts` | 长时间轴虚拟化策略与窗口裁剪逻辑走真实实现（含边界裁剪） |
| `P0-16` Action + Optimistic | `tests/action_optimistic_flow.test.ts` | 导出按钮文案由 pending 状态即时驱动，且 App 同时接入 `useActionState/useOptimistic` |
| `P0-17` 亮色主题与动效统一 | `tests/light_mode_visual_tokens.test.ts`, `tests/theme_system.test.ts` | 亮色默认加载，亮暗切换无闪烁 |
| `P0-18` SyncController Native 化 | `tests/player_sync.test.ts` | 多轨播放时按预算同步，播放不中断 |
| `P0-19` CSP + 自动清理 | `tests/nginx_security_headers.test.ts`, `tests/cleanup_scheduler.test.ts`, `tests/sqlite_db_auto_repair_guard.test.ts`, `tests/db_repair_drill_script.test.ts` | `curl -I` 可见安全头，超期文件自动清理并有指标；DB 自动修复仅在损坏迹象明确时触发；可通过 `bun run drill:db-repair` 执行损坏注入与修复演练 |

## P2 映射清单

| 需求ID | 自动化测试 | 手工验收要点 |
|---|---|---|
| `P2-01` 模型超市治理策略（画像 + 治理） | `tests/model_marketplace_policy_api.test.ts`, `tests/p2_lab_frontend_alignment.test.ts` | 实验室“策略治理”可创建策略、模拟路由、查看执行记录分页与评分拆解；非法 fallback/循环 fallback 会被拒绝 |
| `P2-02` AI 创意闭环深化（版本链） | `tests/creative_pipeline_versioning.test.ts`, `tests/creative_pipeline_api.test.ts`, `tests/p2_lab_frontend_alignment.test.ts` | 实验室“创意闭环”可创建 run、提交 run/scene 反馈、刷新版本链并 commit；从中间版本查询也能拿到完整版本链 |
| `P2-03` 协作平台化（团队空间/云存储/多人协同） | `tests/workspace_platform_api.test.ts`, `tests/workspace_api.test.ts`, `tests/collaboration_service.test.ts`, `tests/p2_lab_frontend_alignment.test.ts`, `tests/p2_end_to_end_flow.test.ts` | 实验室“协作平台”可创建空间、邀请/接受邀请、连接 WS 协同、创建快照并生成上传令牌；非成员 WS 与跨空间 projectId 会被拦截，且 P2 主路径端到端可串通 |

## full_blueprint_alignment 定量标准

- 蓝图覆盖率：`174 / 174 = 100%`（按 `archive/*/plan.md` 勾选项统计）
- 逻辑连通性：核心链路 `8/8` 全通过（模型生成、导演分析、媒体炼金、演员一致性、动捕同步、VFX、导出、监控）
- 视觉一致性：主题变量统一到 `theme.css`，`App.tsx` 不再内联主题块，亮暗模式切换通过自动化校验

```

## 附录 A：26 条轨道需求摘录

### A.1 ai_audio_revolution_20260225

- 轨道目录：`conductor/archive/ai_audio_revolution_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`6/6`
- 说明：AI 音频革命：智能配音 (TTS) 与创意背景音乐合成
- 关键需求摘录：
- **TTS (Text-to-Speech)**: 集成 Google Cloud Text-to-Speech API 或类似的顶级人声合成服务。
- **音频处理**: Web Audio API 用于前端预览，FFmpeg `amix` 和 `loudnorm` 用于后端均衡。
- **AI 音乐匹配**: 利用 Gemini 3.1 Pro 语义分析，生成配乐描述词。
- “文字片段”属性面板增加“生成配音”按钮。
- “音频轨道”支持通过 AI 描述直接搜索/生成 BGM。
- 视频导出时，配音与 BGM 自动平衡音量层级。

### A.2 ai_channels_explosion_20260226

- 轨道目录：`conductor/archive/ai_channels_explosion_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`11/11`
- 说明：AI 渠道大爆发：集成 Luma Dream Machine、Runway Gen-3 与 Pika 1.5 顶级模型集群
- 关键需求摘录：
- **驱动标准化**: 所有新渠道必须实现 `VideoModelDriver` 接口。
- **参数动态化**: 支持模型特有的控制参数（如 Luma 的 Loop 模式、Runway 的 Motion 系数）。
- **异步解耦**: 优化 Long-polling 或 Webhook 逻辑以适配各厂商差异。
- 新增模型：Luma, Runway, Pika。
- 后端总线驱动集群。
- 升级后的 AI 智能模型路由。

### A.3 ai_dimension_breakthrough_20260225

- 轨道目录：`conductor/archive/ai_dimension_breakthrough_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`12/12`
- 说明：AI 维度突破：3D 空间感知预览、AI 变声克隆与智能节奏对齐引擎
- 关键需求摘录：
- **空间感知**: 利用模型生成深度通道（Z-Buffer），前端通过 WebGL/Three.js 容器层实现遮挡预览。
- **音频重塑**: 集成 RVC (Retrieval-based Voice Conversion) 或最新的 Gemini Audio API 进行音色迁移。
- **节奏引擎**: 利用 Web Audio API 的 `AnalyserNode` 提取音频 FFT 数据，计算 BPM 和瞬态峰值。
- 时间轴支持“节奏参考线”。
- 属性面板支持“音色克隆”选项。
- 预览窗口支持文字层开启“3D 透视”模式。

### A.4 ai_director_peak_20260225

- 轨道目录：`conductor/archive/ai_director_peak_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`12/12`
- 说明：AI 创意巅峰：‘一键导演’自动化剪辑、语义级画面蒙版与智能叙事修复
- 关键需求摘录：
- **自动化分镜**: 利用 Gemini 3.1 Pro 解析长文本脚本并生成结构化的时间轴指令。
- **语义蒙版**: 利用 WebGPU 或后端的分割模型（SAM）识别视频主体。
- **自愈式叙事**: 利用多模态推理检测视频生成的逻辑断层。
- “一键导演”控制面板。
- 时间轴支持多层“蒙版轨道”。
- AI 能够全自动填充空白的时间轴。

### A.5 ai_media_alchemy_20260226

- 轨道目录：`conductor/archive/ai_media_alchemy_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`13/13`
- 说明：AI 媒体炼金术：多语种配音同步翻译、视频实时风格迁移与智能素材增强
- 关键需求摘录：
- **音频翻译**: 集成 Gemini 3.1 Pro 强大的翻译能力，并配合现有 `TtsService` 重新生成。
- **风格迁移**: 后端增加 `AlchemyService`，适配支持 Image-to-Video 风格引导的模型（如 Luma/Kling 风格参考）。
- **质量增强**: 利用 AI 超分逻辑对导出环节进行最终优化。
- 前端支持对文字/音频片段发起“翻译并克隆”请求。
- 视频属性面板增加“风格重塑”预设（Van Gogh, Cyberpunk 等）。
- 最终合成质量达到工业级高保真。

### A.6 ai_mixed_reality_20260226

- 轨道目录：`conductor/archive/ai_mixed_reality_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`11/11`
- 说明：虚实共生：AI 实时动作捕捉同步、4K 神经辐射场 (NeRF) 渲染与沉浸式 VR 空间导出
- 关键需求摘录：
- **实时动捕**: 利用 Mediapipe 或同类高效 SDK 进行浏览器端人体骨架提取，并同步至虚拟演员模型。
- **NeRF 渲染**: 后端集成 3D 场景重构引擎，将视频流转化为具备深度信息的辐射场数据。
- **空间视频导出**: 支持 MV-HEVC 编码格式，适配 Vision Pro 空间视频标准。
- 侧边栏新增“动作捕捉”实验室模块。
- 视频预览支持“3D 自由视角”切换。
- 导出选项增加“Vision Pro 空间视频”格式。

### A.7 ai_studio_evolution_20260226

- 轨道目录：`conductor/archive/ai_studio_evolution_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`9/9`
- 说明：AI 影棚级进化：智能重光照 (Relighting)、神经渲染特效与全场景一致性引擎
- 关键需求摘录：
- **智能重光照**: 利用模型估计场景法线（Normal Map），结合点光源/环境光算法进行像素级色彩重绘。
- **神经渲染特效**: 接入专用 VFX 驱动，支持粒子与画面的语义化混合。
- **全场景一致性**: 封装 World-ID 逻辑，确保不同分镜间的环境背景严格对齐。
- 视频属性面板增加“环境光影”调节模块。
- 新增“特效库”面板，支持 AI 粒子叠加。
- 生成接口支持 `world_link: true` 参数。

### A.8 ai_virtual_actors_20260226

- 轨道目录：`conductor/archive/ai_virtual_actors_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`12/12`
- 说明：数字人永生：生成式虚拟演员、高精度对口型 (Lip-Sync) 与 4K HDR 极速渲染引擎
- 关键需求摘录：
- **角色一致性**: 利用 IP-Adapter 或专用的人物引导模型确保演员面部在不同镜头间保持一致。
- **对口型 (Lip-Sync)**: 集成 Wav2Lip 或最新的模型引导参数实现实时嘴部同步。
- **4K HDR**: 后端 FFmpeg 升级为支持 libx265 编码和 4K 分辨率映射。
- 前端支持“演员库”管理。
- 视频生成接口支持 `sync_lip: true` 参数。
- 导出选项增加“4K HDR 高保真”预设。

### A.9 bug_bash_final_20260226

- 轨道目录：`conductor/archive/bug_bash_final_20260226`
- 类型：`bug`
- 状态：`completed`
- 计划完成：`11/11`
- 说明：旗舰版全量 Bug 猎杀：前端渲染异常、状态同步边界与 API 健壮性深度加固
- 关键需求摘录：
- **自动化测试**: 补齐异步 API 调用的边界测试。
- **UI 健壮性**: 处理 React 19 并发渲染下的竞态问题。
- **WebSocket**: 增加心跳检测与重连指数退避算法。
- 全站测试用例 100% 绿灯（包括 E2E 连通性）。
- 时间轴拖拽逻辑在任何边缘位置均无卡死或跳变。
- WebSocket 断开后能自动无感恢复。

### A.10 editor_excellence_plan_20260225

- 轨道目录：`conductor/archive/editor_excellence_plan_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`15/15`
- 说明：编辑器卓越计划：磁吸对齐、全能素材中心与撤销重做系统
- 关键需求摘录：
- **磁吸对齐**: 算法层计算 Clip 边缘与邻近点的距离，若小于阈值则自动修正 `start/end` 时间。
- **历史记录**: 利用 `zustand/middleware` 中的 `temporal` 或自定义 `past/future` 栈管理 Store 快照。
- **素材中心**: 结合后端 API，实现素材的动态加载与预览。
- 时间轴支持片段间的智能吸附。
- 侧边栏新增素材库面板，支持拖拽添加。
- 全局快捷键 `Cmd+Z` / `Cmd+Shift+Z` 支持状态回退。

### A.11 editor_polish_and_composition_20260225

- 轨道目录：`conductor/archive/editor_polish_and_composition_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`17/17`
- 说明：编辑器深度打磨：高级交互、多片段拖拽与后台合成引擎
- 关键需求摘录：
- **前端交互**: 利用 `@xzdarcy/react-timeline-editor` 的 `onActionDrop` 和 `onActionResize` 回调更新 Zustand Store。
- **播放控制**: `requestAnimationFrame` 用于平滑驱动播放指针。
- **后台合成**: 后端引入 `fluent-ffmpeg` 的复杂 filter_complex 处理多轨道合并与剪裁。
- 用户可以在时间轴上随意拖动、修剪片段。
- 实现播放、暂停功能的控制条。
- 后端提供一个 `/api/video/compose` 接口，接收时间轴 JSON 数据并合成最终视频。

### A.12 editor_precision_20260225

- 轨道目录：`conductor/archive/editor_precision_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`11/11`
- 说明：工匠之手：属性面板、精细化时间轴控制与专业右键菜单
- 关键需求摘录：
- **属性联动**: 选中状态管理，双向绑定 Store 数据到 UI 表单。
- **时间轴缩放**: 动态计算 `Timeline` 组件的 `scale` 和 `step`。
- **右键菜单**: 阻止原生 ContextMenu，渲染自定义浮窗。
- 新增“属性检查器”面板。
- 时间轴支持滑块缩放。
- 支持选中片段后按下 `Delete` 键删除。

### A.13 editor_visual_fx_20260225

- 轨道目录：`conductor/archive/editor_visual_fx_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`6/6`
- 说明：视觉艺术进阶：片段转场特效、文字动态预设与全局滤镜引擎
- 关键需求摘录：
- **转场预览**: 在 `MultiVideoPlayer` 中使用 CSS 蒙版或多重 Canvas 合成。
- **文字动画**: 集成 `Framer Motion` 预设到 `TextOverlay`。
- **滤镜引擎**: 后端集成 FFmpeg `lut3d` 或 `colorbalance` 滤镜。
- 时间轴支持片段重叠并自动生成转场。
- 文字属性面板增加“动画预设”下拉框。
- 导出视频包含平滑的转场和选定的色彩滤镜。

### A.14 final_polish_20260226

- 轨道目录：`conductor/archive/final_polish_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`11/11`
- 说明：旗舰版全功能极致打磨与体验抛光：音量平衡、渲染动效与交互细节优化
- 关键需求摘录：
- **音量权重系统**: 升级 `CompositionService`，实现 BGM 自动压低 (Ducking) 逻辑。
- **淡入淡出曲线**: 为音频 Clip 增加平滑的入场和离场音量曲线。
- **渲染占位呼吸灯**: 当 AI 正在生成视频时，在时间轴对应位置展示流光呼吸效果。
- **转场可视化**: 在时间轴片段重叠处显示专用的转场图标按钮。
- **全站对话框重构**: 移除原生 `alert/prompt`，替换为自定义的“玻璃拟态”反馈组件。
- **CSS 全局变量化**: 将所有硬编码颜色（如旗舰蓝 #38bdf8）抽离到 CSS Variables。

### A.15 full_blueprint_alignment_20260227

- 轨道目录：`conductor/archive/full_blueprint_alignment_20260227`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`16/16`
- 说明：补全所有规划的功能与前端功能的偏差，100% 对齐历史蓝图
- 关键需求摘录：
- **AI 导演中控台 (AiDirectorPeak)**：全自动脚本分析、分镜序列可视化、一键编排至时间轴。
- **多模型对比实验室 (MultiModelOrchestrator)**：Gemini, Sora, Kling, Luma 等模型的效果实时分屏对比与参数联动。
- **高级媒体炼金术 (MediaAlchemy)**：TTS 智能配音、BGM 自动生成、AI 画面修复与风格化滤镜实时预览。
- **空间 3D 剪辑引擎 (AiDimensionBreakthrough)**：NeRF 空间感知预览、3D 变换控制轴、立体声场混音看板。
- **虚拟数字人/演员系统 (AiVirtualActors)**：口型同步参数、表情权重滑块、角色一致性锁定工具。
- **工业级时间轴 (EditorExcellence)**：磁吸对齐、Beat 检测、批量剪切、撤销重做（Zundo）物理反馈。

### A.16 init_monorepo_20260225

- 轨道目录：`conductor/archive/init_monorepo_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`17/17`
- 说明：构建 VeoMuse 旗舰版 Monorepo：初始化 Bun Workspaces 并搭建 Elysia 与 React 基础脚手架
- 关键需求摘录：
- **运行时**: Bun 1.1+
- **Monorepo**: Bun Workspaces
- **后端**: ElysiaJS + Eden Treaty
- **前端**: React 18+ (Vite)
- **语言**: TypeScript (全站统一)
- `package.json` 配置 Workspaces。

### A.17 launch_and_deployment_20260226

- 轨道目录：`conductor/archive/launch_and_deployment_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`6/6`
- 说明：旗舰版商业化上线：Docker 容器化、Nginx 高性能部署与全平台发布指南
- 关键需求摘录：
- **容器化**: Docker (Oven/Bun 镜像为基底)。
- **反向代理**: Nginx (OpenResty 兼容)。
- **静态部署**: 前端导出为 SPA 静态包由 Nginx 托管。
- **环境隔离**: 使用 Docker Network 隔离内网服务。
- `Dockerfile` & `docker-compose.yml`。
- `nginx.conf`。

### A.18 migrate_core_logic_20260225

- 轨道目录：`conductor/archive/migrate_core_logic_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`17/17`
- 说明：核心业务迁移与 AI 创意引擎实现：重构 Video 逻辑并实现 AI 智能翻译层
- 关键需求摘录：
- 将原有的 `VideoService` 迁移至 `apps/backend`，适配 Bun 运行时。
- 将旧的 Express 视频生成路由重构为 Elysia 路由，并导出类型定义。
- 实现基于 WebSockets 的实时进度推送（Elysia WebSocket）。
- 引入 `gemini-2.0-flash` 作为智能翻译层。
- 功能：用户输入简单的创意，AI 自动扩充为专业的分镜描述、光影指令和负面提示词。
- 在 React 前端使用 Eden Treaty 接管视频生成流程。

### A.19 multi_model_orchestrator_20260225

- 轨道目录：`conductor/archive/multi_model_orchestrator_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`13/13`
- 说明：全球模型总线：多模型架构抽象、Sora/Kling 对接与智能对比实验室
- 关键需求摘录：
- **适配器模式 (Adapter Pattern)**: 后端定义 `VideoModelDriver` 接口，隔离不同厂商的 API 差异。
- **并发任务管理**: 优化 Redis/内存队列，支持多模型同时生成。
- **分屏预览**: 前端 React 实现多播放器同步对比布局。
- 模型选择器支持：Gemini Veo, Sora (Preview), Kling, Runway Gen-3。
- 后端逻辑统一化：同一套逻辑处理不同模型的 Webhook 和 Polling。
- 前端新增“对比模式”。

### A.20 pro_mastery_boost_20260226

- 轨道目录：`conductor/archive/pro_mastery_boost_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`8/8`
- 说明：专业级增强：全局快捷键、智能预加载与全链路遥测看板
- 关键需求摘录：
- **核心逻辑**：建立全局单例 Hook `useShortcuts`，统一分发指令。
- **快捷键矩阵**：
- **剪辑**：`Space` (播放/暂停), `Cmd/Ctrl+B` (分割), `Backspace/Delete` (删除), `S` (磁吸开关)。
- **导航**：`ArrowLeft/Right` (逐帧微调), `Shift+Arrow` (跳转 1s), `Home/End` (跳转头尾)。
- **系统**：`Cmd+Z/Shift+Z` (撤销/重做), `Cmd+S` (保存项目), `Cmd+J` (快速导出)。
- **核心逻辑**：在 `SyncController` 中引入“前瞻性缓冲”机制。

### A.21 theme_system_20260227

- 轨道目录：`conductor/archive/theme_system_20260227`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`19/19`
- 说明：开发主题系统
- 关键需求摘录：
- 支持预定义的“亮色 (Light)”和“暗色 (Dark)”主题。
- 支持“系统 (System)”模式，自动检测并应用操作系统的 `prefers-color-scheme`。
- 支持“自定义 (Custom)”模式，允许动态修改 CSS 变量以实现自定义调色板。
- 选定的主题偏好（如 'light'、'dark'、'system'）必须持久化存储在浏览器的 `LocalStorage` 中。
- 应用程序在初始加载时必须读取 `LocalStorage`，以防止首屏闪烁 (FOUC)。
- **玻璃面板 (Glass Panels)：** 为背景透明度、`backdrop-filter`（模糊、饱和度）和内阴影设置专用变量。

### A.22 ultimate_excellence_20260226

- 轨道目录：`conductor/archive/ultimate_excellence_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`13/13`
- 说明：极致卓越：架构抽象化、全链路性能量化与高可用健壮性加固
- 关键需求摘录：
- **架构重构**: 抽象 `BaseAiService` 基类，统一全站 AI 调用逻辑。
- **性能监控**: 实现后端 `PerformanceLogger` 与前端渲染性能追踪。
- **健壮性**: 全局错误拦截器（Middleware）与前端异常自愈逻辑。
- **原子化**: 前端组件库彻底解耦。
- AI 服务层代码量减少 30%+（通过继承）。
- 控制台可实时查看 API 响应耗时。

### A.23 ultimate_optimize_20260226

- 轨道目录：`conductor/archive/ultimate_optimize_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`25/25`
- 说明：全部优化好！全方位对齐 2026 最佳实践
- 关键需求摘录：
- **React 19 Actions**: 在所有表单和异步操作中引入 `useActionState`，替代传统的 `useState` 加载管理。
- **Optimistic UI**: 利用 `useOptimistic` 实现瞬间交互反馈，消除生成和编辑过程中的心理等待。
- **并发渲染与虚拟化**: 为 120s+ 时间轴引入 React 并发模式和长列表虚拟化，确保高密度剪辑下无掉帧。
- **Vite 8 / Rolldown 优化**: 开启 Oxc 混淆与 Rolldown 深度构建优化，实现极速的生产环境加载。
- **Shared Type Bridge**: 在 `packages/shared` 中建立统一的类型中转站，彻底隔离前后端源码引用，解决 Monorepo 循环依赖隐患。
- **Eden Treaty 3.0**: 采用官方推荐的最稳健导出模型，实现 100% 强类型 E2E 通讯。

### A.24 ultimate_polish_20260226

- 轨道目录：`conductor/archive/ultimate_polish_20260226`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`16/16`
- 说明：全部处理好！全方位性能量化、代码复用提升与 UX 深度打磨
- 关键需求摘录：
- **[后端] 架构大一统**: 强制所有 AI 业务服务继承自 `BaseAiService`，实现全站统一的重试、日志与耗时量化。
- **[后端] 清理样板代码**: 移除路由层冗余的 try-catch，利用 Elysia 全局拦截器实现错误闭环。
- **[性能] 预览引擎 Native 化**: 剥离预览同步逻辑，通过独立的同步控制器直接操作视频 Ref，极大降低 React 调度开销。
- **[UI/UX] 现代化美学重塑**:
- 全站统一使用玻璃拟态 Toast 反馈。
- 调优入场动画的物理弹性曲线（Spring Physics）。

### A.25 video_editor_core_20260225

- 轨道目录：`conductor/archive/video_editor_core_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`17/17`
- 说明：次世代多轨道视频编辑器：构建时间轴、预览引擎与 AI 自动剪辑基础
- 关键需求摘录：
- **UI 组件**: `@xzdarcy/react-timeline-editor`
- **状态管理**: `Zustand` (管理复杂的片段、时间、层级数据)
- **同步引擎**: 自研 `SyncMaster` (协调时间轴与多个视频实例)
- **AI 赋能**: Gemini 3.1 Pro (语义分析与剪辑决策)
- 支持多轨道编辑的 React 界面。
- 片段拖拽、剪辑、同步预览的核心闭环。

### A.26 visual_storytelling_20260225

- 轨道目录：`conductor/archive/visual_storytelling_20260225`
- 类型：`feature`
- 状态：`completed`
- 计划完成：`6/6`
- 说明：视听叙事大师：动态文字、多音轨母带处理与转场特效引擎
- 关键需求摘录：
- **文字渲染**: Canvas API 用于前端实时预览，FFmpeg `drawtext` 滤镜用于后端合成。
- **多音轨合成**: FFmpeg `amix` 滤镜处理多路音频输入。
- **数据结构升级**: 片段对象增加 `type: 'video' | 'audio' | 'text'`，支持不同的属性集。
- 时间轴支持新增“文字轨道”和“音频轨道”。
- 后端合成引擎支持合并背景音乐并叠加文字水印。
- 前端播放器支持同步播放背景音乐。
