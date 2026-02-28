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
