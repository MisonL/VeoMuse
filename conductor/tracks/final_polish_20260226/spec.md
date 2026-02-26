# Specification: 旗舰版全功能极致打磨

## 1. 音频大师级抛光 (Audio Polish)
- **音量权重系统**: 升级 `CompositionService`，实现 BGM 自动压低 (Ducking) 逻辑。
- **淡入淡出曲线**: 为音频 Clip 增加平滑的入场和离场音量曲线。

## 2. 视觉与反馈抛光 (Visual & Feedback)
- **渲染占位呼吸灯**: 当 AI 正在生成视频时，在时间轴对应位置展示流光呼吸效果。
- **转场可视化**: 在时间轴片段重叠处显示专用的转场图标按钮。
- **全站对话框重构**: 移除原生 `alert/prompt`，替换为自定义的“玻璃拟态”反馈组件。

## 3. 性能与规范抛光 (Performance & Style)
- **CSS 全局变量化**: 将所有硬编码颜色（如旗舰蓝 #38bdf8）抽离到 CSS Variables。
- **LightningCSS 兼容性**: 彻底清理所有非标准选择器。
