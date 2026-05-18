# Nebula Flow WebUI 第一轮实施计划

## 执行顺序

1. 补充 DOM 契约测试，锁定空态 launchpad、AI 提权入口和时间轴 AI CTA。
2. 运行相关测试确认 RED。
3. 修改 React 结构：中心空态卡片化、左侧命令轨道标识、时间轴 AI CTA 标识。
4. 增加最后加载的 CSS 覆盖层，集中处理 Nebula Flow token、空态、命令轨道和 AI CTA。
5. 运行相关测试、构建、`git diff --check`。
6. 用浏览器打开 Docker 网关确认首屏视觉与控制台状态。

## 验证命令

```bash
bun test tests/app_shell_empty_state.dom.test.tsx --max-concurrency 1
bun run build
git diff --check
```

## 风险控制

- 本轮只改 UI 壳层和样式，不碰后端、数据库和模型调用。
- 如 Docker 仍加载旧资产，需要执行 `bun run docker:up` 后再浏览器复验。
- 不把 DOM 测试通过等同于最终视觉通过，必须补浏览器检查。

## 第二轮执行记录

1. 用 Docker 页面检查 `director-canvas-launchpad`、中心 AI 卡片和时间轴 AI CTA 的 computed style。
2. 发现第一轮低特异性 Nebula 规则被 `54-app.css` 的运行态修正规则覆盖。
3. 在 `55-app.css` 增加主题作用域高特异性覆盖，限定在编辑器空态桌面断点。
4. 在 CSS 模块化守卫中补充 Nebula Flow 运行态特异性断言。
5. 重新构建、重建 Docker、浏览器复查最新 CSS 资产和 computed style。

## 第二轮验证命令

```bash
bun test tests/app_css_modularity.test.ts --max-concurrency 1
bun test tests/app_shell_empty_state.dom.test.tsx tests/app_component_interactions.dom.test.tsx --max-concurrency 1
bun run build
bun run docker:up
bun run scripts/docker_smoke_check.ts --keep-up --no-build
bun run docker:ui-smoke -- --workers=1 --retries=0 tests/e2e/docker/all-ui-surfaces.spec.ts
git diff --check
```

## 第三轮执行记录

1. 用 Docker 页面复查左侧 AI 入口、中心 launchpad、时间轴 CTA 的可见层级。
2. 确认第三轮重点不是继续加背景，而是补齐 `Prompt -> Shots -> Timeline` 工作流叙事。
3. 在中心 launchpad 增加 `AI 创作链路` 三段式 route spine。
4. 在左侧 AI 导演入口增加 `Core` 徽标，在时间轴 AI CTA 增加 `Queue` 队列标记。
5. 新增最终 CSS layer `56-app.css`，隔离第三轮桥接样式。
6. 补充 DOM 和 CSS 守卫测试。

## 第四轮执行记录

1. 复查右侧 `PropertyInspector` 空态，确认它仍是首屏中最弱的 Nebula Flow 断点。
2. 给右侧面板壳层增加 `data-shell-role="inspector-console"`。
3. 在未选中片段空态增加 `Inspector Console` 标识和 `Inspect / Tune / Render` 检查链路。
4. 新增最终 CSS layer `57-app.css`，只覆盖右侧控制台桥接样式。
5. 补充 `PropertyInspector` DOM、App DOM 和 CSS 模块化守卫测试。
6. 浏览器复查发现懒加载 `PropertyInspector.css` 会被后加载并压掉部分右侧空态背景；在组件 CSS 尾部补高特异性兜底，并加入守卫。

## 第五轮执行记录

1. 已在 `AppHeader` 顶栏加入只读 `Director Flow` 总线，保持模式切换、主题、画幅和导出交互不变。
2. `Director Flow` 暴露 `data-testid="director-flow-bus"`，并显示 `Prompt / Shots / Timeline / Inspect / Render` 五段链路。
3. 顶栏壳层暴露 `data-shell-role="director-flow-command"`，用于限定第五轮样式作用域。
4. 最终 CSS layer `58-app.css` 只覆盖顶栏 flow 胶囊和移动端降噪，并由 `App.css` 按顺序导入。
5. `tests/app_component_interactions.dom.test.tsx` 与 `tests/app_css_modularity.test.ts` 覆盖顶栏 DOM 契约和 `58-app.css` 隔离性。

## 第六轮执行记录

1. 已在 `AppCenterPanel` 的 `monitor-bottom-bar` 中加入只读 `Output Dock` 结构，保持播放、跳转、画幅展示和“视频实验室”按钮行为不变。
2. `Output Dock` 暴露 `data-testid="output-dock"`，并显示 `Preview / Lab / Render` 输出链路。
3. 底部栏暴露 `data-shell-role="output-dock"`，用于限定第六轮样式作用域。
4. 最终 CSS layer `59-app.css` 只覆盖输出 dock 视觉和移动端降噪，并由 `App.css` 按顺序导入。
5. `tests/app_shell_empty_state.dom.test.tsx` 与 `tests/app_css_modularity.test.ts` 覆盖输出 dock DOM 契约和 `59-app.css` 隔离性。

## 第七轮执行记录

1. 已在 `AppTimeline` 状态条中加入只读 `Timeline Bus` 结构，保持撤销、工具切换、时间轴空态 CTA 和指标展示行为不变。
2. `Timeline Bus` 暴露 `data-testid="timeline-bus"`，并显示 `Queue / Sync / Deliver` 装配链路。
3. 时间轴容器暴露 `data-shell-role="timeline-bus"`，用于限定第七轮样式作用域。
4. 最终 CSS layer `60-app.css` 只覆盖时间轴总线视觉和移动端降噪，并由 `App.css` 按顺序导入。
5. `tests/app_shell_empty_state.dom.test.tsx` 与 `tests/app_css_modularity.test.ts` 覆盖时间轴总线 DOM 契约和 `60-app.css` 隔离性。

## 第八轮执行记录

1. 已在 `App` 左侧 AI 导演按钮加入只读 `Command Rail` 链路，保持素材库、AI 导演、演员库和动捕实验室切换行为不变。
2. `Command Rail` 暴露 `data-testid="command-rail-flow"`，并显示 `Brief / Cast / Build` 入口链路。
3. 左侧面板暴露 `data-shell-role="command-rail"`，用于限定第八轮样式作用域。
4. 最终 CSS layer `61-app.css` 只覆盖命令轨链路视觉、窄宽度降噪和后续素材面板命中修复，并由 `App.css` 按顺序导入。
5. `tests/app_component_interactions.dom.test.tsx` 与 `tests/app_css_modularity.test.ts` 覆盖命令轨 DOM 契约和 `61-app.css` 隔离性。

## 第九轮执行记录

1. 已在 `AppCenterPanel` 音频大师分支加入只读 `Audio Bus` 结构，保留“导入音频素材”按钮回调。
2. `Audio Bus` 暴露 `data-testid="audio-bus"` 和 `data-visual-system="nebula-flow"`，并显示 `Input / Rhythm / Delivery` 母带链路。
3. 最终 CSS layer `62-app.css` 只覆盖音频总线视觉和窄高度降噪，并由 `App.css` 按顺序导入。
4. `tests/app_shell_empty_state.dom.test.tsx` 覆盖音频大师 DOM 契约，确认音频总线、状态塔和 lane 仍存在。
5. `tests/app_css_modularity.test.ts` 覆盖 `62-app.css` 隔离性，防止音频总线样式回流到其他 CSS layer。

## 第十轮执行记录

1. 已在 `AppCenterPanel` 的 `labSurface="watch"` 分支加入只读 `Watch Bus` 结构，保留 `TelemetryDashboard` 内容原样渲染。
2. `Watch Bus` 暴露 `data-testid="watch-bus"` 和 `data-visual-system="nebula-flow"`，并显示 `Observe / Repair / Release` 运维链路。
3. 最终 CSS layer `63-app.css` 只覆盖监控总线视觉和窄高度降噪，并由 `App.css` 按顺序导入。
4. `tests/app_shell_empty_state.dom.test.tsx` 覆盖实验室监控 DOM 契约，确认监控壳层与监控面板内容仍存在。
5. `tests/app_css_modularity.test.ts` 覆盖 `63-app.css` 隔离性，防止监控总线样式回流到其他 CSS layer。
