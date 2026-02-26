# Specification: VeoMuse 专业级生产力与性能增强 (Pro Mastery)

## 1. 业务目标
将 VeoMuse 从“顶级工具”跃迁为“行业标准”，通过引入专业级软件（如 Premiere, Final Cut Pro）的交互范式与运行监控，实现生产力与系统透明度的质质变。

## 2. 功能需求
### 2.1 全局快捷键总线 (Shortcut Command Bus)
- **核心逻辑**：建立全局单例 Hook `useShortcuts`，统一分发指令。
- **快捷键矩阵**：
    - **剪辑**：`Space` (播放/暂停), `Cmd/Ctrl+B` (分割), `Backspace/Delete` (删除), `S` (磁吸开关)。
    - **导航**：`ArrowLeft/Right` (逐帧微调), `Shift+Arrow` (跳转 1s), `Home/End` (跳转头尾)。
    - **系统**：`Cmd+Z/Shift+Z` (撤销/重做), `Cmd+S` (保存项目), `Cmd+J` (快速导出)。

### 2.2 预测性资产预加载 (Smart Proactive Preloading)
- **核心逻辑**：在 `SyncController` 中引入“前瞻性缓冲”机制。
- **策略**：当播放头距离下一个 Clip 的起点不足 5 秒时，自动触发该资产的 `media.load()`。

### 2.3 全链路遥测与性能仪表盘 (Telemetry Dashboard)
- **后端**：聚合 `BaseAiService` 产生的所有指标，新增 `/api/admin/metrics` 接口。
- **前端**：在属性面板中增加“性能实验室”视图，实时通过 Canvas/ECharts 渲染。

## 3. 验收标准
- 专业剪辑师仅凭键盘即可完成 80% 的常规剪辑操作。
- 在并发 10+ 轨道切换时，黑帧闪烁率降低 95% 以上。
- 仪表盘能准确反映 24 小时内的系统稳定性趋势。
