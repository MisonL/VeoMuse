# Specification: 视觉艺术进阶计划

## 目标
提升 VeoMuse 产出视频的艺术质感，通过转场、动画和滤镜实现电影级的视觉表现。

## 关键技术栈
- **转场预览**: 在 `MultiVideoPlayer` 中使用 CSS 蒙版或多重 Canvas 合成。
- **文字动画**: 集成 `Framer Motion` 预设到 `TextOverlay`。
- **滤镜引擎**: 后端集成 FFmpeg `lut3d` 或 `colorbalance` 滤镜。

## 预期产出
- 时间轴支持片段重叠并自动生成转场。
- 文字属性面板增加“动画预设”下拉框。
- 导出视频包含平滑的转场和选定的色彩滤镜。
