# 执行计划：主题系统开发

## 阶段 1：CSS 架构与主题变量 [checkpoint: c7e3048]
- [x] 任务：创建 `theme.css`，包含亮色、暗色和自定义主题的 `:root` 变量。 [526db5f]
- [x] 任务：定义玻璃面板变量（背景、模糊、饱和度、阴影）。 [526db5f]
- [x] 任务：定义字体排版变量（主要、次要、强调）。 [526db5f]
- [x] 任务：定义交互 UI 变量（按钮、输入框、边框）。 [526db5f]
- [x] 任务：添加 CSS 过渡规则，确保主题切换平滑。 [526db5f]
- [x] 任务：Conductor - 用户手册验证 '阶段 1：CSS 架构与主题变量' (协议见 workflow.md) [c7e3048]

## 阶段 2：状态管理 (Zustand)
- [ ] 任务：为主题 Store 逻辑编写单元测试（默认系统、更新主题、自定义色板）。
- [ ] 任务：使用 Zustand 创建 `themeStore.ts`，管理当前主题模式和自定义色板状态。
- [ ] 任务：为 `themeStore` 实现 LocalStorage 持久化中间件。
- [ ] 任务：Conductor - 用户手册验证 '阶段 2：状态管理 (Zustand)' (协议见 workflow.md)

## 阶段 3：React Hooks 与系统同步
- [ ] 任务：为 `useThemeSync` Hook 编写单元测试。
- [ ] 任务：实现 `useThemeSync` Hook，监听 `window.matchMedia('(prefers-color-scheme: dark)')`。
- [ ] 任务：实现根据激活的主题状态动态更新文档 `data-theme` 属性和 CSS 自定义属性的逻辑。
- [ ] 任务：Conductor - 用户手册验证 '阶段 3：React Hooks 与系统同步' (协议见 workflow.md)

## 阶段 4：UI 集成与控件
- [ ] 任务：为主题切换器 UI 组件编写单元测试。
- [ ] 任务：构建主题切换器组件（在亮色、暗色、系统模式间切换）。
- [ ] 任务：将主题切换器集成到主应用布局中（例如顶栏或设置面板）。
- [ ] 任务：重构 `App.tsx` 和 `Atoms.tsx` 中现有的内联颜色，改为使用 CSS 变量。
- [ ] 任务：Conductor - 用户手册验证 '阶段 4：UI 集成与控件' (协议见 workflow.md)
